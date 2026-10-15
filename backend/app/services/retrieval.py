"""
RecallAI Graph Retrieval Service
Performs 2-hop prerequisite graph traversals in FalkorDB, ranks active memories,
builds real evidence traversal steps, and generates deterministic explanations.
"""
import logging
from typing import List, Dict, Any, Optional, Tuple, Set
from backend.app.database import db_manager
from backend.app.schemas import MemoryItem, EvidenceStep, EvidencePath
from backend.app.services.curriculum import CURATED_CONCEPTS, seed_curriculum_if_needed
from backend.app.queries import (
    TRAVERSE_PREREQUISITES_1_HOP,
    TRAVERSE_PREREQUISITES_2_HOP,
    GET_MEMORIES_FOR_CONCEPTS,
    GET_ACTIVE_PREFERENCES
)

logger = logging.getLogger("recallai.retrieval")

# Concept alias dictionary for fuzzy/keyword concept matching
CONCEPT_ALIASES = {
    "recursion": ["recursion", "recursive", "recurse", "base condition", "call stack"],
    "functions": ["function", "functions", "def ", "def(", "scope", "return statement"],
    "variables": ["variable", "variables", "assignment", "types", "data types"],
    "loops": ["loop", "loops", "for loop", "while loop", "iteration"],
    "conditionals": ["if statement", "if/else", "conditionals", "boolean", "conditions"],
    "lists": ["list", "lists", "tuple", "tuples", "indexing", "slicing"],
    "dictionaries": ["dict", "dicts", "dictionary", "dictionaries", "hashmap", "key-value"],
    "list_comprehensions": ["list comprehension", "list comprehensions", "comprehension"],
    "generators": ["generator", "generators", "yield", "iterator", "iterators"],
    "classes": ["class", "classes", "oop", "object-oriented", "instances"],
    "inheritance": ["inheritance", "polymorphism", "subclass", "super()"],
    "error_handling": ["try/except", "exceptions", "error handling", "raise exception"],
    "decorators": ["decorator", "decorators", "@"],
    "file_io": ["file io", "reading files", "open()", "with open"],
    "concurrency": ["async", "asyncio", "concurrency", "await", "coroutines"]
}

def identify_concepts_in_text(text: str) -> List[str]:
    """
    Identifies curriculum concepts referenced in the user text.
    Returns matched concept IDs in order of relevance.
    """
    text_lower = text.lower()
    matched: List[str] = []

    for concept_id, aliases in CONCEPT_ALIASES.items():
        if any(alias in text_lower for alias in aliases):
            matched.append(concept_id)

    return matched

class RetrievalService:
    def __init__(self):
        self._db = db_manager

    def retrieve_context(
        self,
        user_id: str,
        message: str
    ) -> Tuple[List[MemoryItem], List[EvidencePath], str]:
        """
        Retrieves relevant active memories and constructs real evidence paths
        via 2-hop prerequisite traversal in FalkorDB.
        Returns (ranked_memories, evidence_paths, explanation).
        """
        graph = self._db.get_user_graph(user_id)
        seed_curriculum_if_needed(graph)

        matched_concept_ids = identify_concepts_in_text(message)

        # 1. If no educational concepts matched, check if active preferences exist
        if not matched_concept_ids:
            prefs = self._get_active_preferences(graph, user_id)
            if prefs:
                explanation = f"No specific curriculum concepts detected. Included {len(prefs)} general teaching preference(s)."
                return prefs[:3], [], explanation
            else:
                return [], [], "No relevant memories matched this query."

        # 2. Traverse Prerequisites (1-Hop and 2-Hop)
        prereq_1_hop_edges: List[Dict[str, str]] = []
        prereq_2_hop_edges: List[Dict[str, str]] = []
        all_concept_ids: Set[str] = set(matched_concept_ids)

        try:
            res_hop1 = graph.ro_query(TRAVERSE_PREREQUISITES_1_HOP, {"concept_ids": matched_concept_ids})
            for row in res_hop1.result_set:
                from_id, from_name, rel, to_id, to_name = row
                all_concept_ids.add(to_id)
                prereq_1_hop_edges.append({
                    "from_id": from_id,
                    "from_name": from_name,
                    "to_id": to_id,
                    "to_name": to_name
                })
        except Exception as e:
            logger.warning("1-hop prerequisite traversal failed: %s", e)

        try:
            res_hop2 = graph.ro_query(TRAVERSE_PREREQUISITES_2_HOP, {"concept_ids": matched_concept_ids})
            for row in res_hop2.result_set:
                from_id, mid_id, mid_name, rel, to_id, to_name = row
                all_concept_ids.add(to_id)
                prereq_2_hop_edges.append({
                    "from_id": from_id,
                    "mid_id": mid_id,
                    "to_id": to_id,
                    "to_name": to_name
                })
        except Exception as e:
            logger.warning("2-hop prerequisite traversal failed: %s", e)

        # 3. Fetch active user memories on all matched and prerequisite concepts
        direct_memories: List[MemoryItem] = []
        prereq_memories: List[MemoryItem] = []
        concept_memory_map: Dict[str, List[MemoryItem]] = {}

        try:
            res_mems = graph.ro_query(GET_MEMORIES_FOR_CONCEPTS, {
                "user_id": user_id,
                "concept_ids": list(all_concept_ids)
            })
            for row in res_mems.result_set:
                mem_id, kind, val, status, origin, src, sess, created, c_id, c_name = row
                item = MemoryItem(
                    id=mem_id,
                    kind=kind,
                    value=val,
                    status=status,
                    origin=origin,
                    source_text=src,
                    session_id=sess,
                    created_at=str(created)
                )
                if c_id not in concept_memory_map:
                    concept_memory_map[c_id] = []
                concept_memory_map[c_id].append(item)

                if c_id in matched_concept_ids:
                    direct_memories.append(item)
                else:
                    prereq_memories.append(item)
        except Exception as e:
            logger.warning("Fetching memories for concepts failed: %s", e)

        # 4. Fetch user preferences
        prefs = self._get_active_preferences(graph, user_id)

        # 5. Build Real Evidence Paths from returned edges
        evidence_paths: List[EvidencePath] = []

        for c_id in matched_concept_ids:
            # Check if user has memory on this concept
            user_has_memory = c_id in concept_memory_map and len(concept_memory_map[c_id]) > 0

            # If user has a direct memory on this concept
            if user_has_memory:
                # Steps start with (User)-[:HAS_MEMORY]->(Concept)
                steps = [
                    EvidenceStep(
                        from_node=user_id,
                        relation="HAS_MEMORY",
                        to_node=c_id,
                        origin="You said"
                    )
                ]
                # Look for prerequisite edges originating from c_id
                edges_1 = [e for e in prereq_1_hop_edges if e["from_id"] == c_id]
                for e1 in edges_1:
                    step1 = EvidenceStep(
                        from_node=e1["from_id"],
                        relation="REQUIRES",
                        to_node=e1["to_id"],
                        origin="Curated"
                    )
                    # Look for 2nd hop edges from e1["to_id"]
                    edges_2 = [e for e in prereq_1_hop_edges if e["from_id"] == e1["to_id"]]
                    if edges_2:
                        for e2 in edges_2:
                            steps_chain = steps + [
                                step1,
                                EvidenceStep(
                                    from_node=e2["from_id"],
                                    relation="REQUIRES",
                                    to_node=e2["to_id"],
                                    origin="Curated"
                                )
                            ]
                            evidence_paths.append(EvidencePath(steps=steps_chain))
                    else:
                        evidence_paths.append(EvidencePath(steps=steps + [step1]))

                if not edges_1:
                    # Single step path
                    evidence_paths.append(EvidencePath(steps=steps))

        # 6. Rank: Direct Memories > Prerequisite Memories > Preferences (Cap ~8)
        # Deduplicate while preserving rank
        seen_ids = set()
        ranked_memories: List[MemoryItem] = []

        for m in direct_memories:
            if m.id not in seen_ids:
                seen_ids.add(m.id)
                ranked_memories.append(m)

        for m in prereq_memories:
            if m.id not in seen_ids:
                seen_ids.add(m.id)
                ranked_memories.append(m)

        for m in prefs:
            if m.id not in seen_ids:
                seen_ids.add(m.id)
                ranked_memories.append(m)

        ranked_memories = ranked_memories[:8]

        # 7. Deterministic Explanation Template
        explanation_parts = []
        if direct_memories:
            direct_concepts = list({m.value for m in direct_memories})
            explanation_parts.append(f"Retrieved {len(direct_memories)} direct memory statement(s) on {', '.join(direct_concepts)}")
        if prereq_memories:
            prereq_names = list({e['to_id'] for e in prereq_1_hop_edges + prereq_2_hop_edges})
            explanation_parts.append(f"traversed {len(prereq_names)} prerequisite concept(s) ({', '.join(prereq_names)})")
        if prefs:
            explanation_parts.append(f"applied {len(prefs)} teaching preference(s)")

        if explanation_parts:
            explanation = "; ".join(explanation_parts) + "."
        elif matched_concept_ids:
            explanation = f"Detected concept '{matched_concept_ids[0]}' but no prior user memories were recorded."
        else:
            explanation = "No relevant memories matched this query."

        return ranked_memories, evidence_paths, explanation

    def _get_active_preferences(self, graph, user_id: str) -> List[MemoryItem]:
        """Helper to fetch active PREFERS memories for a user."""
        try:
            res_prefs = graph.ro_query(GET_ACTIVE_PREFERENCES, {"user_id": user_id})
            prefs = []
            for row in res_prefs.result_set:
                prefs.append(MemoryItem(
                    id=row[0],
                    kind=row[1],
                    value=row[2],
                    status=row[3],
                    origin=row[4],
                    source_text=row[5],
                    session_id=row[6],
                    created_at=str(row[7])
                ))
            return prefs
        except Exception as e:
            logger.warning("Fetching active preferences failed: %s", e)
            return []

retrieval_service = RetrievalService()
