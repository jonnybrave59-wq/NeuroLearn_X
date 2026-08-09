import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StudentOverview } from "./StudentApp";


const common = {
  meaning: "Learner-specific meaning.",
  why_matters: "Learner-specific importance.",
  interpretation: "Current learner interpretation.",
  pathway_effect: "Current pathway effect.",
  latest_evidence_at: "2026-08-09T08:00:00Z",
  data_quality: "Calculated from valid saved evidence.",
  related_path: "/student/mastery",
};

const snapshot = {
  student: {
    display_name: "Ari Learner",
    participant_code: "ARI001",
    is_demo: false,
    created_at: "2026-08-01T00:00:00Z",
    last_sign_in_at: "2026-08-09T08:00:00Z",
    account_status: "Active",
  },
  diagnostic: {
    available: false,
    completed: true,
    analysis_complete: true,
    item_count: 30,
    latest_result: {
      score: 18,
      max_score: 30,
      accuracy: 0.6,
      cognitive_load_category: "Moderate",
      submitted_at: "2026-08-09T08:00:00Z",
    },
    priority_gaps: [{ concept_id: 7, concept: "Scalars and Vectors", mastery_score: 0.6 }],
  },
  notifications: [],
  target: { id: 7, code: "GP-SV", name: "Scalars and Vectors" },
  mastery: [{ concept_id: 7, concept: "Scalars and Vectors", score: 0.6 }],
  mastery_average: 0.6,
  gaps: [{ id: 1, concept_id: 7, concept: "Scalars and Vectors", mastery_score: 0.6 }],
  progress: { completed: 1, total: 2 },
  recent_activity: [],
  pathway: {
    total_minutes: 30,
    steps: [
      { id: 1, activity_id: 1, activity: "Vector review", concept: "Scalars and Vectors", required: true, completed_at: "2026-08-08T00:00:00Z", estimated_minutes: 10, predicted_load_index: 0.4 },
      { id: 2, activity_id: 2, activity: "Vector guided lab", concept: "Scalars and Vectors", required: true, completed_at: null, estimated_minutes: 20, predicted_load_index: 0.5 },
    ],
  },
  explainability: {
    average_mastery: {
      ...common,
      available: true,
      value: 0.6,
      sum_mastery: 0.6,
      concept_count: 1,
      threshold: 0.75,
      concepts: [{ concept_id: 7, concept: "Scalars and Vectors", score: 0.6, calculation_mode: "latest", below_threshold: true, latest_evidence_at: "2026-08-09T08:00:00Z", attempts: [{ earned: 3, maximum: 5 }] }],
    },
    model_predicted_cognitive_load: {
      ...common,
      available: false,
      category: null,
      index: null,
      reported_mental_effort: { rating: 5, category: "Moderate", reported_at: "2026-08-09T08:00:00Z" },
      disclaimer: "Not a medical diagnosis.",
    },
    current_target: {
      ...common,
      available: true,
      concept: { id: 7, name: "Scalars and Vectors" },
      mastery: 0.6,
      threshold: 0.75,
      detected_gap: true,
      prerequisites: [{ concept_id: 6, concept: "Trigonometric Ratios", mastery: 0.7, below_threshold: true }],
      reason: "Actual target reason from saved evidence.",
    },
    pathway_progress: {
      ...common,
      available: true,
      completed: 1,
      total: 2,
      remaining: 1,
      percentage: 0.5,
      steps: [{ activity: "Vector review", concept: "Scalars and Vectors", status: "Completed" }, { activity: "Vector guided lab", concept: "Scalars and Vectors", status: "Current" }],
    },
    next_recommended_step: {
      ...common,
      available: true,
      activity: "Vector guided lab",
      concept: "Scalars and Vectors",
      learning_gap: { concept: "Scalars and Vectors", mastery: 0.6, threshold: 0.75 },
      prerequisites: ["Trigonometric Ratios"],
      estimated_minutes: 20,
      difficulty: "Moderate",
      predicted_load_index: 0.5,
      selection_reason: "Selected from the learner's current evidence.",
      aps: {
        available: true,
        gap_coverage: 1,
        predicted_cognitive_load: 0.5,
        normalized_learning_time: 0.25,
        score: 0.8,
        weights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
        alternatives: [],
        selection_reason: "Highest valid APS.",
      },
      related_path: "/student/pathway",
    },
  },
};


describe("Student Overview explainability", () => {
  it("keeps cards compact and opens only one evidence-backed explanation at a time", () => {
    render(<MemoryRouter><StudentOverview snapshot={snapshot} /></MemoryRouter>);

    expect(screen.getByText("Current target")).toBeInTheDocument();
    expect(screen.getByText("Average mastery")).toBeInTheDocument();
    expect(screen.getByText("Model-Predicted Cognitive Load")).toBeInTheDocument();
    expect(screen.getByText("Pathway progress")).toBeInTheDocument();
    expect(screen.getByText("Next recommended step")).toBeInTheDocument();
    expect(screen.getAllByText("How was this determined?")).toHaveLength(6);
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
    expect(screen.queryByText(/Reported mental effort remains separate/)).not.toBeInTheDocument();
    expect(screen.queryByText("Current learner interpretation.")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[id$="-explanation"]')).toHaveLength(0);

    const masteryCard = screen.getByText("Average mastery").closest("article");
    expect(masteryCard).not.toBeNull();
    fireEvent.click(within(masteryCard!).getByText("How was this determined?"));
    expect(masteryCard!.querySelector('[role="math"][aria-label="Mastery for concept i equals earned score divided by maximum score"]')).toBeInTheDocument();
    expect(within(masteryCard!).getByText("3/5")).toBeInTheDocument();
    expect(document.querySelectorAll('[id$="-explanation"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "How was Current target determined?" }));
    expect(screen.getByText("Actual target reason from saved evidence.")).toBeInTheDocument();
    expect(document.querySelector('[role="math"][aria-label="Mastery for concept i equals earned score divided by maximum score"]')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[id$="-explanation"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "How were the personalized diagnostic results determined?" }));
    expect(document.querySelector('[role="math"][aria-label="Baseline accuracy equals earned score divided by maximum score times one hundred"]')).toBeInTheDocument();
    expect(screen.getByText(/Reported cognitive load is separate from model prediction/)).toBeInTheDocument();
    expect(document.querySelectorAll('[id$="-explanation"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.querySelectorAll('[id$="-explanation"]')).toHaveLength(0);
    expect(screen.queryByText(/\{"/)).not.toBeInTheDocument();
  });
});
