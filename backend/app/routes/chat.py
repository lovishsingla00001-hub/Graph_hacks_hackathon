"""
RecallAI Chat Turn Route
POST /chat endpoint executing the complete Agent Memory & Tutoring pipeline.
"""
import logging
from fastapi import APIRouter, status
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
    all_warnings: list[WarningItem] = []
    saved_memories: list[MemoryItem] = []

    # Step 1: Memory Extraction
    extracted_items, extract_warnings = extraction_service.extract_memories(request.message)
    all_warnings.extend(extract_warnings)

    # Step 2: Store or Resolve Memories in FalkorDB
    for item in extracted_items:
        try:
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

    try:
        retrieved_memories, evidence_paths, explanation = retrieval_service.retrieve_context(
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
            retrieved_memories=retrieved_memories
        )
    except Exception as e:
        logger.error("Answer generation failed: %s", e)
        all_warnings.append(WarningItem(stage="llm", message=f"Answer generation error: {e}"))
        # Partial success guarantee: If memory was successfully written, return HTTP 200 with warnings!
        if saved_memories:
            reply = (
                "I have recorded your learning updates into your FalkorDB memory graph, "
                "but encountered a temporary issue generating a full tutoring answer. Please ask your question again!"
            )
        else:
            reply = (
                "I am having trouble connecting to the language model right now. "
                "Please check your API configuration or try again in a few moments."
            )

    return ChatResponse(
        reply=reply,
        saved_memories=saved_memories,
        retrieved_memories=retrieved_memories,
        evidence_paths=evidence_paths,
        warnings=all_warnings,
        explanation=explanation
    )
