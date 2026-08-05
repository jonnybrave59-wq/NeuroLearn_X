from __future__ import annotations

import math

import pytest

from app.algorithms import (
    Candidate,
    adaptive_pathway_score,
    classify_mastery,
    expected_cognitive_load,
    gap_coverage,
    mastery_score,
    normalize_learning_times,
    predicted_pathway_load,
    prerequisite_ancestors,
    rank_candidates,
    topological_order,
    weighted_mastery,
    would_create_cycle,
)


def test_mastery_calculation_and_classification():
    assert mastery_score(3, 4) == 0.75
    assert mastery_score(0, 0) is None
    assert classify_mastery(None, 0.75) == "Not Yet Assessed"
    assert classify_mastery(0.75, 0.75) == "Mastered"
    assert classify_mastery(0.60, 0.75) == "Developing"
    assert classify_mastery(0.40, 0.75) == "Needs Review"


def test_weighted_mastery_gives_more_weight_to_recent_evidence():
    score = weighted_mastery([(1, 4), (4, 4)])
    assert score == pytest.approx(0.75)
    assert score > 0.625


def test_graph_cycle_detection_ancestors_and_topological_order():
    edges = [(1, 2), (2, 3), (4, 3)]
    assert would_create_cycle(edges, 3, 1)
    assert not would_create_cycle(edges, 1, 4)
    assert prerequisite_ancestors(edges, 3) == {1, 2, 4}
    order = topological_order({1, 2, 3, 4}, edges)
    assert order.index(1) < order.index(2) < order.index(3)
    assert order.index(4) < order.index(3)
    with pytest.raises(ValueError):
        topological_order({1, 2}, [(1, 2), (2, 1)])


def test_gap_coverage_and_division_by_zero():
    assert gap_coverage(2, 4) == 0.5
    assert gap_coverage(0, 0) == 1.0


def test_pcl_expected_load_and_empty_path():
    assert predicted_pathway_load([0.2, 0.6]) == pytest.approx(0.4)
    assert predicted_pathway_load([]) == 0
    assert expected_cognitive_load(
        {"Low": 0.2, "Moderate": 0.5, "High": 0.3}
    ) == pytest.approx(0.55)


def test_learning_time_normalization_and_equal_time_case():
    assert normalize_learning_times([10, 20, 30]) == [0, 0.5, 1]
    assert normalize_learning_times([15, 15, 15]) == [0, 0, 0]
    assert normalize_learning_times([]) == []


def test_aps_calculation_and_weight_validation():
    score = adaptive_pathway_score(1, 0.4, 0.5, 0.5, 0.3, 0.2)
    assert score == pytest.approx(0.78)
    with pytest.raises(ValueError):
        adaptive_pathway_score(1, 0.4, 0.5, 0.5, 0.5, 0.5)


def test_candidate_ranking_preserves_valid_order_and_metrics():
    candidates = [
        Candidate("guided", [1, 2], [10, 20], [0.25, 0.35], 35, 1),
        Candidate("fast", [3, 4], [10, 20], [0.45, 0.55], 20, 1),
    ]
    ranked = rank_candidates(candidates, 0.5, 0.3, 0.2)
    assert {item.label for item in ranked} == {"guided", "fast"}
    assert all(item.concept_ids == [10, 20] for item in ranked)
    assert ranked[0].score >= ranked[1].score
    assert all(math.isfinite(item.score) for item in ranked)

