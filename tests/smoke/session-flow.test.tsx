import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/renderer/app-shell/AppShell";
import { defaultLocalState } from "../../src/core/persistence";
import { installSmokeCourse, markCourseMastered, smallSmokeCourse, smokeCourse } from "./course-fixture";

describe("desktop session flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installSmokeCourse();
  });

  it("moves from an imported course through setup into a question", async () => {
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    expect(screen.getByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    expect(screen.getByText("Question 1 of 8")).toBeVisible();
    expect(screen.getByText("Your answer")).toBeVisible();
  });

  it("removes a learning question after its first fully correct answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const saveLocalState = installSmokeCourse(defaultLocalState(), smallSmokeCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Multiple choice" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Property to name" }));
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Cuculus canorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/Mastered/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText(/session complete/i)).toBeVisible();
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({
      learningHistory: expect.arrayContaining([
        expect.objectContaining({
          courseId: smallSmokeCourse.id,
          questionCount: 1,
          attemptCount: 1,
          records: expect.arrayContaining([
            expect.objectContaining({
              question: expect.objectContaining({ prompt: expect.any(String) }),
              submittedAnswers: ["Cuculus canorus"],
              evaluation: expect.objectContaining({ fullyCorrect: true }),
            }),
          ]),
        }),
      ]),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    fireEvent.click(screen.getByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Learning history 1/ }));
    fireEvent.click(screen.getByText(/Question and answer comparison/));
    expect(screen.getByText("Your answer: Cuculus canorus")).toBeVisible();
    expect(screen.getByText("Correct answer: Cuculus canorus")).toBeVisible();
    vi.restoreAllMocks();
  });

  it("requires two consecutive correct answers only after a learning error", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    installSmokeCourse(defaultLocalState(), smallSmokeCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Multiple choice" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Property to name" }));
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));

    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Cuculus canorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText("Correct once. Answer it correctly once more.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Cuculus canorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/Mastered/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText(/session complete/i)).toBeVisible();
    vi.restoreAllMocks();
  });

  it("counts down and submits an unanswered timed test question", async () => {
    installSmokeCourse(markCourseMastered(defaultLocalState(), smokeCourse));
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /^Testing/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Per-question timer/ }));
    fireEvent.click(screen.getByRole("button", { name: "10s" }));
    fireEvent.click(screen.getByRole("button", { name: /Begin Testing/i }));
    expect(screen.getByText("10s")).toBeVisible();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("9s")).toBeVisible();
    await act(async () => vi.advanceTimersByTime(9000));
    expect(screen.getByText("Not quite")).toBeVisible();
    vi.useRealTimers();
  });

  it("applies question type and count controls", async () => {
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Text input" }));
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin Learning/i }));
    expect(screen.getByText("Question 1 of 3")).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("persists an unfinished learning snapshot and exposes a resume entry", async () => {
    const saveLocalState = installSmokeCourse(defaultLocalState());
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin Learning/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save and exit" }));
    expect(screen.getByText("Choose what to master")).toBeVisible();
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({
      version: 7,
      learningSessions: expect.objectContaining({
        [smokeCourse.id]: expect.objectContaining({
          courseId: smokeCourse.id,
          progress: expect.objectContaining({ queue: expect.any(Array) }),
        }),
      }),
    }));
    expect(screen.getByRole("button", { name: /Resume learning/i })).toBeEnabled();
  });

  it("stores a failed test as knowledge-project difficulty records", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const saveLocalState = installSmokeCourse(markCourseMastered(defaultLocalState(), smallSmokeCourse), smallSmokeCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Multiple choice" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Property to name" }));
    fireEvent.click(screen.getByRole("button", { name: /^Testing/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin Testing/i }));
    for (let index = 0; index < 2; index += 1) {
      fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    }
    expect(await screen.findByRole("heading", { name: "Progress worth keeping." })).toBeVisible();
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({
      version: 7,
      difficultyRecords: [
        { courseId: smallSmokeCourse.id, objectId: "cuckoo", consecutiveCorrect: 0 },
        { courseId: smallSmokeCourse.id, objectId: "skylark", consecutiveCorrect: 0 },
      ],
    }));
  });
});
