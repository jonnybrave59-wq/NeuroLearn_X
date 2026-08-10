import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import HomePage from "./HomePage";


describe("HomePage", () => {
  it("explains the system and exposes the required portals and install control", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Master the concepts you need before moving to the next lesson.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Student Portal")).toBeInTheDocument();
    expect(screen.getByText("Teacher Portal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How NeuroLearn-X Works" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create Student Account" }),
    ).toHaveAttribute("href", "/register/student");
    expect(
      screen.getAllByRole("button", { name: "Install NeuroLearn-X" }),
    ).toHaveLength(2);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About NeuroLearn-X" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Transparent by design");
    expect(screen.getByRole("dialog")).toHaveTextContent("Mastery evidence");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
