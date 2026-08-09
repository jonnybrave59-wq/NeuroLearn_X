from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Iterable


def mastery_score(earned: float, maximum: float) -> float | None:
    if maximum <= 0:
        return None
    return max(0.0, min(1.0, earned / maximum))


def weighted_mastery(attempt_scores: list[tuple[float, float]]) -> float | None:
    """Weight recent attempts more heavily while retaining historical evidence."""
    valid = [(e, m) for e, m in attempt_scores if m > 0]
    if not valid:
        return None
    weights = list(range(1, len(valid) + 1))
    ratios = [earned / maximum for earned, maximum in valid]
    return max(0.0, min(1.0, sum(r * w for r, w in zip(ratios, weights)) / sum(weights)))


def classify_mastery(score: float | None, threshold: float) -> str:
    if score is None:
        return "Not Yet Assessed"
    if score >= threshold:
        return "Mastered"
    if score >= threshold * 0.7:
        return "Developing"
    return "Needs Review"


def would_create_cycle(
    edges: Iterable[tuple[int, int]], prerequisite_id: int, succeeding_id: int
) -> bool:
    if prerequisite_id == succeeding_id:
        return True
    adjacency: dict[int, set[int]] = defaultdict(set)
    for source, target in edges:
        adjacency[source].add(target)
    adjacency[prerequisite_id].add(succeeding_id)
    stack = [succeeding_id]
    visited: set[int] = set()
    while stack:
        current = stack.pop()
        if current == prerequisite_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        stack.extend(adjacency[current])
    return False


def prerequisite_ancestors(edges: Iterable[tuple[int, int]], target_id: int) -> set[int]:
    reverse: dict[int, set[int]] = defaultdict(set)
    for source, target in edges:
        reverse[target].add(source)
    ancestors: set[int] = set()
    stack = list(reverse[target_id])
    while stack:
        node = stack.pop()
        if node in ancestors:
            continue
        ancestors.add(node)
        stack.extend(reverse[node])
    return ancestors


def topological_order(nodes: Iterable[int], edges: Iterable[tuple[int, int]]) -> list[int]:
    node_set = set(nodes)
    indegree = {node: 0 for node in node_set}
    adjacency: dict[int, set[int]] = defaultdict(set)
    for source, target in edges:
        if source in node_set and target in node_set and target not in adjacency[source]:
            adjacency[source].add(target)
            indegree[target] += 1
    queue = deque(sorted(node for node, degree in indegree.items() if degree == 0))
    ordered: list[int] = []
    while queue:
        node = queue.popleft()
        ordered.append(node)
        for neighbor in sorted(adjacency[node]):
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    if len(ordered) != len(node_set):
        raise ValueError("Knowledge graph contains a cycle")
    return ordered


def gap_coverage(addressed: int, diagnosed: int) -> float:
    if diagnosed == 0:
        return 1.0
    return max(0.0, min(1.0, addressed / diagnosed))


def predicted_pathway_load(activity_loads: list[float]) -> float:
    if not activity_loads:
        return 0.0
    return sum(activity_loads) / len(activity_loads)


def normalize_learning_times(times: list[float]) -> list[float]:
    if not times:
        return []
    minimum, maximum = min(times), max(times)
    if maximum == minimum:
        return [0.0 for _ in times]
    return [(value - minimum) / (maximum - minimum) for value in times]


def adaptive_pathway_score(
    coverage: float,
    predicted_load: float,
    normalized_time: float,
    alpha: float,
    beta: float,
    gamma: float,
) -> float:
    if abs(alpha + beta + gamma - 1.0) > 1e-6:
        raise ValueError("Optimization weights must sum to 1")
    return alpha * coverage + beta * (1 - predicted_load) + gamma * (1 - normalized_time)


def expected_cognitive_load(probabilities: dict[str, float]) -> float:
    return (
        0.0 * probabilities.get("Low", 0)
        + 0.5 * probabilities.get("Moderate", 0)
        + 1.0 * probabilities.get("High", 0)
    )


@dataclass
class Candidate:
    label: str
    activity_ids: list[int]
    concept_ids: list[int]
    loads: list[float]
    total_minutes: int
    gap_coverage: float
    predicted_load: float = 0
    normalized_time: float = 0
    score: float = 0


def rank_candidates(
    candidates: list[Candidate], alpha: float, beta: float, gamma: float
) -> list[Candidate]:
    normalized = normalize_learning_times([candidate.total_minutes for candidate in candidates])
    for candidate, normalized_time in zip(candidates, normalized):
        candidate.predicted_load = predicted_pathway_load(candidate.loads)
        candidate.normalized_time = normalized_time
        candidate.score = adaptive_pathway_score(
            candidate.gap_coverage,
            candidate.predicted_load,
            normalized_time,
            alpha,
            beta,
            gamma,
        )
    return sorted(
        candidates,
        key=lambda candidate: (
            -candidate.score,
            -candidate.gap_coverage,
            candidate.predicted_load,
            candidate.total_minutes,
            tuple(candidate.activity_ids),
        ),
    )
