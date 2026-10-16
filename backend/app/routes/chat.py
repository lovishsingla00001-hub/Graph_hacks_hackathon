"""
RecallAI Chat Turn Route
POST /chat endpoint executing the complete Agent Memory & Tutoring pipeline.
"""
import logging
from fastapi import APIRouter, HTTPException, status
from backend.app.schemas import ChatRequest, ChatResponse, WarningItem, MemoryItem
from backend.app.services.extraction import extraction_service
from backend.app.services.memory_store import memory_store
from backend.app.services.retrieval import retrieval_service
from backend.app.services.answer_generation import answer_generation_service

logger = logging.getLogger("recallai.chat")

router = APIRouter(tags=["Chat"])

@router.post("/chat", response_model=ChatResponse)
def chat_turn(request: ChatRequest) -> ChatResponse:
    """
    Executes a single chat turn:
    1. Validates input schemas.
    2. Extracts explicit facts/struggles/preferences with guardrails.
    3. Persists memories or resolves corrections in the user's isolated FalkorDB graph.
    4. Traverses 2-hop prerequisite graph to retrieve relevant context and real evidence.
    5. Synthesizes a personalized educational response using retrieved context as data.
    """
    if "/simulate-error" in request.message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Simulated 500 error from /simulate-error command."
        )

    all_warnings: list[WarningItem] = []
    saved_memories: list[MemoryItem] = []

    # Step 1: Memory Extraction
    extracted_items, extract_warnings = extraction_service.extract_memories(request.message)
    all_warnings.extend(extract_warnings)

    # Step 2: Store or Resolve Memories in FalkorDB
    for item in extracted_items:
        try:
            if "/simulate-write-failure" in request.message:
                raise RuntimeError("Simulated FalkorDB write failure for /simulate-write-failure command")
            if item.is_correction:
                resolved = memory_store.resolve_memory(
                    user_id=request.user_id,
                    kind=item.kind,
                    canonical_value=item.value
                )
                if resolved:
                    saved_memories.append(resolved)
            else:
                saved = memory_store.save_memory(
                    user_id=request.user_id,
                    session_id=request.session_id,
                    kind=item.kind,
                    value=item.value,
                    source_text=item.source_text,
                    concept_id=item.canonical_concept
                )
                saved_memories.append(saved)
        except Exception as e:
            logger.error("Failed to persist memory in FalkorDB: %s", e)
            all_warnings.append(WarningItem(stage="memory_write", message=f"FalkorDB write failed: {e}"))

    # Step 3: Graph Retrieval (2-hop prerequisite traversal)
    retrieved_memories = []
    evidence_paths = []
    explanation = "No relevant memories matched this query."
    prereq_concepts = []

    try:
        retrieved_memories, evidence_paths, explanation, prereq_concepts = retrieval_service.retrieve_context(
            user_id=request.user_id,
            message=request.message
        )
    except Exception as e:
        logger.error("Retrieval stage failed: %s", e)
        all_warnings.append(WarningItem(stage="retrieval", message=f"Retrieval error: {e}"))

    # Step 4: Answer Generation
    reply = ""
    try:
        reply = answer_generation_service.generate_tutoring_answer(
            user_message=request.message,
            retrieved_memories=retrieved_memories,
            prerequisite_concepts=prereq_concepts
        )
    except Exception as e:
        logger.error("Answer generation failed: %s", e)
        reason = str(e).strip()
        all_warnings.append(WarningItem(stage="llm", message=f"Answer generation error: {reason}"))
        # Partial success guarantee: Clearly labeled system message, never disguised as a tutor reply
        if saved_memories:
            reply = f"[System Message] Answer model unavailable: {reason}. Your memory was saved to your knowledge graph."
        else:
            reply = f"[System Message] Answer model unavailable: {reason}."

    return ChatResponse(
        reply=reply,
        saved_memories=saved_memories,
        retrieved_memories=retrieved_memories,
        evidence_paths=evidence_paths,
        warnings=all_warnings,
        explanation=explanation
    )
