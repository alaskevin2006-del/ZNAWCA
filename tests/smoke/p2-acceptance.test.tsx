import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/core/persistence";
import { AppShell } from "../../src/renderer/app-shell/AppShell";
import { installSmokeCourse } from "./course-fixture";

const savedCourse: Course = {
  id: "saved",
  title: "Saved Course",
  directory: "C:/Courses/Saved",
  workbookPath: "C:/Courses/Saved/Saved.xlsx",
  sheetName: "Sheet1",
  columns: [{ index: 2, title: "Fact", displayTitle: "Fact", filterOnly: false }],
  items: ["Alpha", "Bravo", "Charlie", "Delta"].map((name, index) => ({
    id: name.toLowerCase(),
    name,
    sourceRow: index + 2,
    values: { Fact: [`Fact ${name}`] },
    media: [],
  })),
};

function installState(state = defaultLocalState()) {
  state.settings.courseRoot = "C:/Courses";
  const saveLocalState = vi.fn().mockResolvedValue(undefined);
  window.znawca = {
    chooseCourse: vi.fn(),
    scanCourseRoot: vi.fn().mockResolvedValue({
      rootDirectory: "C:/Courses",
      reports: [{ canOpen: true, issues: [], course: savedCourse }],
    }),
    loadLocalState: vi.fn().mockResolvedValue(state),
    saveLocalState,
  };
  return saveLocalState;
}

describe("P2 completion contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installState();
  });

  it("does not show the non-functional create-course mock card", () => {
    render(<AppShell />);
    expect(screen.queryByText("Create your course")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Birds" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Rocks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guided demo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add course or library" })).toBeVisible();
  });

  it("keeps session setup in the course-opening flow instead of the sidebar", async () => {
    render(<AppShell />);
    expect(screen.queryByRole("button", { name: "Session setup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score history" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Difficult items" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    expect(screen.getByRole("heading", { name: "Shape this session" })).toBeVisible();
  });

  it("automatically rescans the saved library and restores the recent course", async () => {
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    state.settings.recentCourseId = "saved";
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot: vi.fn().mockResolvedValue({
        rootDirectory: "C:/Courses",
        reports: [{ canOpen: true, issues: [], course: savedCourse }],
      }),
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState: vi.fn(),
    };
    render(<AppShell />);
    expect(await screen.findByText("Saved Course")).toBeVisible();
    expect(window.znawca.scanCourseRoot).toHaveBeenCalledWith("C:/Courses");
  });

  it("keeps history and difficult content inside the opened course context", async () => {
    const otherCourse: Course = {
      ...savedCourse,
      id: "other",
      title: "Other Course",
      directory: "C:/Courses/Other",
      workbookPath: "C:/Courses/Other/Other.xlsx",
    };
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    state.testHistory = [
      {
        schemaVersion: 1, id: "saved-history", courseId: "saved", courseTitle: "Saved Course",
        startedAt: "2026-07-30T00:00:00.000Z", completedAt: "2026-07-30T00:01:00.000Z",
        scope: { filters: [], selectedQuestionTypes: [], requestedQuestionCount: 4, teachingStyle: "strict", difficultFirst: false },
        timerSeconds: 0,
        summary: { total: 4, answered: 4, fullyCorrect: 1, partiallyCorrect: 0, incorrect: 3, timedOut: 0, score: 1, percentage: 25, records: [] },
      },
      {
        schemaVersion: 1, id: "other-history", courseId: "other", courseTitle: "Other Course",
        startedAt: "2026-07-30T01:00:00.000Z", completedAt: "2026-07-30T01:01:00.000Z",
        scope: { filters: [], selectedQuestionTypes: [], requestedQuestionCount: 4, teachingStyle: "strict", difficultFirst: false },
        timerSeconds: 0,
        summary: { total: 4, answered: 4, fullyCorrect: 3, partiallyCorrect: 0, incorrect: 1, timedOut: 0, score: 3, percentage: 75, records: [] },
      },
    ];
    state.difficultyRecords = [
      { courseId: "saved", objectId: "alpha", consecutiveCorrect: 1 },
      { courseId: "other", objectId: "omega", consecutiveCorrect: 0 },
    ];
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot: vi.fn().mockResolvedValue({
        rootDirectory: "C:/Courses",
        reports: [
          { canOpen: true, issues: [], course: savedCourse },
          { canOpen: true, issues: [], course: otherCourse },
        ],
      }),
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState: vi.fn(),
    };
    render(<AppShell />);
    const savedCard = (await screen.findByRole("heading", { name: "Saved Course" })).closest("article")!;
    fireEvent.click(within(savedCard).getByRole("button", { name: "Open course" }));
    expect(screen.getByRole("navigation", { name: "Saved Course" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Test history/ }));
    expect(screen.getByText("25%")).toBeVisible();
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Difficult items/ }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeVisible();
    // D-10: difficulty is object-level, so the card shows recovery progress
    // (out of 2 clean sessions) instead of a per-project aspect label.
    expect(screen.getByText("Consecutive correct")).toBeVisible();
    expect(screen.getByText(/1 \/ 2/)).toBeVisible();
    expect(screen.queryByText(/Weight/)).not.toBeInTheDocument();
    expect(screen.queryByText(/omega/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/0 \/ \d+ mastered/)).toBeVisible();
  });

  it("removes an imported course from the library without deleting its local records", async () => {
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    state.courses.saved = { lastOpenedAt: "2026-07-30T00:00:00.000Z", completedSessions: 2 };
    const saveLocalState = vi.fn().mockResolvedValue(undefined);
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot: vi.fn().mockResolvedValue({
        rootDirectory: "C:/Courses",
        reports: [{ canOpen: true, issues: [], course: savedCourse }],
      }),
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState,
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove course Saved Course" }));
    expect(screen.queryByRole("button", { name: "Remove course Saved Course" })).not.toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith(
      "Remove this course from Znawca? Files on disk will not be deleted.",
    );
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({
      version: 7,
      courses: state.courses,
      settings: expect.objectContaining({ removedCourseIds: ["saved"] }),
    }));
  });

  it("keeps a removed course hidden after the saved library is rescanned", async () => {
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    state.settings.removedCourseIds = ["saved"];
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot: vi.fn().mockResolvedValue({
        rootDirectory: "C:/Courses",
        reports: [{ canOpen: true, issues: [], course: savedCourse }],
      }),
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState: vi.fn(),
    };
    render(<AppShell />);
    await waitFor(() => expect(window.znawca!.scanCourseRoot).toHaveBeenCalledWith("C:/Courses"));
    expect(screen.queryByRole("button", { name: "Remove course Saved Course" })).not.toBeInTheDocument();
  });

  it("persists session preferences and exposes unavailable directions", async () => {
    const saveLocalState = installState();
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    expect(screen.getByRole("checkbox", { name: "Image to name" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Testing/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Per-question timer/ }));
    fireEvent.click(screen.getByRole("button", { name: "10s" }));
    fireEvent.click(screen.getByRole("button", { name: /^Teaching style/ }));
    fireEvent.click(screen.getByRole("button", { name: /Lenient/ }));
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({
      version: 7,
      settings: expect.objectContaining({
        mode: "testing",
        timerSeconds: 10,
        strictDistractors: false,
      }),
    }));
  });

  it("keeps the start action visible while opening only one setup section at a time", async () => {
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));

    expect(screen.getByRole("button", { name: /Begin Learning/i })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Text input" })).not.toBeInTheDocument();

    const questionTypes = screen.getByRole("button", { name: /^Question types/ });
    const scope = screen.getByRole("button", { name: /^Scope and filters/ });
    const strategy = screen.getByRole("button", { name: /^Teaching style/ });
    expect(questionTypes).toHaveAttribute("aria-expanded", "false");
    expect(scope).toHaveAttribute("aria-expanded", "false");
    expect(strategy).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(questionTypes);
    expect(screen.getByRole("checkbox", { name: "Text input" })).toBeVisible();
    expect(questionTypes).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(scope);
    expect(screen.queryByRole("checkbox", { name: "Text input" })).not.toBeInTheDocument();
    expect(questionTypes).toHaveAttribute("aria-expanded", "false");
    expect(scope).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Begin Learning/i })).toBeVisible();
  });

  it("defaults to an automatic resumable smart batch and places timing in its own scope", async () => {
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    expect(screen.getByRole("button", { name: /Smart batch/ })).toHaveClass("active");
    expect(screen.getByRole("spinbutton", { name: "Questions" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /^Scope and filters/ }));
    expect(screen.queryByRole("checkbox", { name: /Prioritize difficult content/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Teaching style/ }));
    expect(screen.queryByRole("checkbox", { name: /Prioritize difficult content/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Testing/ }));
    expect(screen.getByRole("button", { name: /^Per-question timer/ })).toBeVisible();
  });

  it("temporarily explains why an unavailable direction cannot be selected", async () => {
    try {
      render(<AppShell />);
      fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
      vi.useFakeTimers();
      const unavailable = screen.getByRole("checkbox", { name: "Image to name" });
      fireEvent.click(unavailable.parentElement!);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Image to name: Unavailable for this course or filter",
      );
      act(() => vi.advanceTimersByTime(2500));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows matched and extra answer parts, and no missed row", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    installSmokeCourse(defaultLocalState(), {
      ...savedCourse,
      title: "Answer Parts",
      columns: [{ index: 2, title: "Diet", displayTitle: "Diet", filterOnly: false }],
      items: [
        { id: "cuckoo", name: "Common Cuckoo", sourceRow: 2, values: { Diet: ["insects", "seeds", "nuts"] }, media: [] },
        { id: "skylark", name: "Eurasian Skylark", sourceRow: 3, values: { Diet: ["grain"] }, media: [] },
        { id: "great-tit", name: "Great Tit", sourceRow: 4, values: { Diet: ["beetles"] }, media: [] },
        { id: "blackbird", name: "Common Blackbird", sourceRow: 5, values: { Diet: ["worms"] }, media: [] },
      ],
    });
    const { container } = render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Multiple choice" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Property to name" }));
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "insects; extra" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(container.querySelector(".feedback-details")).toHaveTextContent("Matched: insects");
    expect(container.querySelector(".feedback-details")).toHaveTextContent("Your incorrect answer was: extra");
    expect(container.querySelector(".feedback-details")).not.toHaveTextContent("Missed");
  });

  it("clears test history from the settings data controls after confirmation", () => {
    const state = defaultLocalState();
    state.testHistory = [{
      schemaVersion: 1,
      id: "history-1",
      courseId: "saved",
      courseTitle: "Saved Course",
      startedAt: "2026-07-30T00:00:00.000Z",
      completedAt: "2026-07-30T00:01:00.000Z",
      scope: { filters: [], selectedQuestionTypes: [], requestedQuestionCount: 3, teachingStyle: "strict", difficultFirst: false },
      timerSeconds: 0,
      summary: { total: 0, answered: 0, fullyCorrect: 0, partiallyCorrect: 0, incorrect: 0, timedOut: 0, score: 0, percentage: 0, records: [] },
    }];
    const saveLocalState = installState(state);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear test history" }));
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({ testHistory: [] }));
  });

  it("reviews the original test question, submitted answer and correct answer", async () => {
    const state = defaultLocalState();
    const question = {
      id: "saved:alpha:fact:name-to-property:input",
      objectId: "cuckoo",
      kind: "input" as const,
      direction: "name-to-property" as const,
      prompt: "Scientific name?",
      acceptedAnswers: ["Cuculus canorus"],
    };
    state.testHistory = [{
      schemaVersion: 1,
      id: "history-saved",
      courseId: "saved",
      courseTitle: "Saved Course",
      startedAt: "2026-07-30T00:00:00.000Z",
      completedAt: "2026-07-30T00:01:00.000Z",
      scope: { filters: [], selectedQuestionTypes: ["input", "name-to-property"], requestedQuestionCount: 1, teachingStyle: "strict", difficultFirst: false },
      timerSeconds: 10,
      summary: {
        total: 1, answered: 1, fullyCorrect: 0, partiallyCorrect: 0, incorrect: 1, timedOut: 0, score: 0, percentage: 0,
        records: [{ questionId: question.id, question, submittedAnswers: ["wrong"], evaluation: { score: 0, fullyCorrect: false, matched: [], missed: ["Cuculus canorus"], extra: ["wrong"] }, timedOut: false, elapsedMs: 1000, answeredAt: "2026-07-30T00:00:10.000Z" }],
      },
    }];
    installState(state);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    const historyButton = await screen.findByRole("button", { name: /^Test history/ });
    fireEvent.click(historyButton);
    expect(screen.getByText(/Questions 1.*Timer per question: 10s/)).toBeVisible();
    fireEvent.click(screen.getByText(/Question and answer comparison/));
    expect(screen.getByText("Scientific name?")).toBeVisible();
    expect(screen.getByText("Your answer: wrong")).toBeVisible();
    expect(screen.getByText("Correct answer: Cuculus canorus")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Testing" })).not.toBeInTheDocument();
  });
});
