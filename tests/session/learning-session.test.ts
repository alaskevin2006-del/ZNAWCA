import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningSession } from "../../src/core/session/learning-session.js";
import type { AnswerEvaluation, Question } from "../../src/core/quiz/types.js";

const correct: AnswerEvaluation = { score: 1, fullyCorrect: true, matched: ["yes"], missed: [], extra: [] };
const wrong: AnswerEvaluation = { score: 0, fullyCorrect: false, matched: [], missed: ["yes"], extra: ["no"] };
const question = (id: string): Question => ({ id, objectId: id, kind: "input", direction: "name-to-property", prompt: "Question", acceptedAnswers: ["yes"] });

describe("learning session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes an initially correct question immediately", () => {
    const session = new LearningSession([question("a")]);
    session.answer("a", correct);
    expect(session.isComplete()).toBe(true);
  });

  it("requires two consecutive correct answers after an error and resets on another error", () => {
    const session = new LearningSession([question("a"), question("b")]);
    session.answer("a", wrong);
    expect(session.current()?.id).toBe("b");
    session.answer("b", correct);
    session.answer("a", correct);
    expect(session.isComplete()).toBe(false);
    session.answer("a", wrong);
    session.answer("a", correct);
    session.answer("a", correct);
    expect(session.isComplete()).toBe(true);
  });

  it("reshuffles the active queue after a missed learning question", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);
    const session = new LearningSession([question("a"), question("b"), question("c"), question("d")]);

    session.answer("a", wrong);

    expect(session.snapshot().queue.map((entry) => entry.question.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("does not treat an answer with extras as complete even when every part matched", () => {
    const multiExtra: AnswerEvaluation = { score: 1, fullyCorrect: false, matched: ["a", "b"], missed: [], extra: ["c"] };
    const session = new LearningSession([question("a")]);
    session.answer("a", multiExtra);
    expect(session.isComplete()).toBe(false);
  });

  it("can resume from a serialized snapshot", () => {
    const session = new LearningSession([question("a")]);
    session.answer("a", wrong, "2026-07-30T01:00:00.000Z");
    const resumed = new LearningSession(session.snapshot());
    expect(resumed.current()?.id).toBe("a");
    expect(resumed.snapshot().records).toEqual([
      {
        questionId: "a",
        question: question("a"),
        evaluation: wrong,
        answeredAt: "2026-07-30T01:00:00.000Z",
        submittedAnswers: [],
      },
    ]);
  });
});
