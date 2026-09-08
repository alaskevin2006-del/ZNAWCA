import { describe, expect, it } from "vitest";
import { TestingSession } from "../../src/core/session/testing-session.js";
import type { AnswerEvaluation, Question } from "../../src/core/quiz/types.js";

const partial: AnswerEvaluation = { score: 0.5, fullyCorrect: false, matched: ["a"], missed: ["b"], extra: [] };
const question = (id: string): Question => ({ id, objectId: id, kind: "input", direction: "name-to-property", prompt: "Question", acceptedAnswers: ["a", "b"] });

describe("testing session", () => {
  it("rejects unsupported timer durations", () => {
    expect(() => new TestingSession([], 12 as never)).toThrow(RangeError);
  });

  it("shows each question once and scores only fully correct answers", () => {
    const session = new TestingSession([question("a"), question("b")], 0);
    session.current(100);
    session.submit("a", { evaluation: partial, submittedAnswers: ["a"], answeredAt: "2026-07-30T01:00:00.000Z" }, 200);
    session.current(300);
    session.submit("b", partial, 400);
    expect(session.isComplete()).toBe(true);
    expect(session.summary()).toMatchObject({
      total: 2, answered: 2, fullyCorrect: 0, partiallyCorrect: 2,
      incorrect: 2, timedOut: 0, score: 0, percentage: 0,
    });
    expect(session.summary().records[0]).toMatchObject({
      questionId: "a", question: { id: "a" }, submittedAnswers: ["a"],
      answeredAt: "2026-07-30T01:00:00.000Z",
    });
  });

  it("marks a question wrong when its 10 second timer expires", () => {
    const session = new TestingSession([question("a")], 10);
    session.current(1_000);
    expect(session.remainingMs(5_000)).toBe(6_000);
    const record = session.expire(11_000);
    expect(record).toMatchObject({ timedOut: true, evaluation: { score: 0 } });
    expect(session.isComplete()).toBe(true);
  });

  it("counts an answer with extras as incorrect even when its score is 1", () => {
    const multiExtra: AnswerEvaluation = { score: 1, fullyCorrect: false, matched: ["a", "b"], missed: [], extra: ["c"] };
    const session = new TestingSession([question("a")], 0);
    session.current(100);
    session.submit("a", { evaluation: multiExtra }, 200);
    expect(session.summary()).toMatchObject({ fullyCorrect: 0, incorrect: 1, score: 0 });
  });
});
