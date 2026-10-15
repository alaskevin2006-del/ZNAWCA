import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "../../src/core/quiz/scoring";
import type { Question } from "../../src/core/quiz/types";
import {
  LearningSessionController,
  TestingSessionController,
  type SessionIdentity,
} from "../../src/core/session/index";

const questions: Question[] = [
  { id: "q1", objectId: "bird-1", kind: "input", direction: "name-to-property", prompt: "Food?", acceptedAnswers: ["seeds", "nuts"] },
  { id: "q2", objectId: "bird-2", kind: "choice", direction: "image-to-name", prompt: "Bird?", acceptedAnswers: ["Skylark"] },
];

const identity: SessionIdentity = {
  id: "session-1",
  courseId: "birds",
  courseTitle: "Birds",
  startedAt: "2026-07-30T01:00:00.000Z",
  scope: {
    filters: [{ field: "#region", values: ["Europe"] }],
    selectedQuestionTypes: ["input", "image-to-name"],
    requestedQuestionCount: 2,
    teachingStyle: "strict",
    difficultFirst: true,
  },
};

describe("session controllers", () => {
  it("serializes and resumes an unfinished learning session", () => {
    const controller = new LearningSessionController(identity, questions);
    controller.answer("q1", evaluateAnswer(["seeds", "nuts"], ["seeds"]), "2026-07-30T01:01:00.000Z");
    const saved = controller.save("2026-07-30T01:02:00.000Z");

    expect(saved.progress.queue.map((item) => item.question.id)).toEqual(["q2", "q1"]);
    expect(saved.progress.queue[1]).toMatchObject({ requiredStreak: 2, correctStreak: 0, attempts: 1 });

    const resumed = LearningSessionController.resume(saved);
    expect(resumed.current()?.id).toBe("q2");
    expect(resumed.records()).toHaveLength(1);
  });

  it("creates detailed learning history only after mastery", () => {
    const controller = new LearningSessionController(identity, [questions[0]!]);
    expect(() => controller.history()).toThrow("before the session is complete");
    controller.answer(
      "q1",
      evaluateAnswer(["seeds", "nuts"], ["seeds", "nuts"]),
      "2026-07-30T01:01:00.000Z",
      ["seeds", "nuts"],
    );

    expect(controller.history("2026-07-30T01:02:00.000Z")).toMatchObject({
      courseId: "birds",
      completedAt: "2026-07-30T01:02:00.000Z",
      questionCount: 1,
      attemptCount: 1,
      records: [{
        question: questions[0],
        submittedAnswers: ["seeds", "nuts"],
        evaluation: { fullyCorrect: true },
      }],
    });
  });

  it("creates detailed test history only after completion", () => {
    const controller = new TestingSessionController(identity, questions, 10);
    controller.current(1_000);
    controller.submit("q1", {
      evaluation: evaluateAnswer(["seeds", "nuts"], ["seeds"]),
      submittedAnswers: ["seeds"],
      answeredAt: "2026-07-30T01:01:00.000Z",
    }, 5_000);
    expect(() => controller.history()).toThrow("before the test is complete");
    controller.current(6_000);
    controller.expire(16_000);

    const history = controller.history("2026-07-30T01:03:00.000Z");
    expect(history).toMatchObject({
      courseId: "birds",
      timerSeconds: 10,
      completedAt: "2026-07-30T01:03:00.000Z",
      summary: {
        total: 2,
        answered: 2,
        partiallyCorrect: 1,
        incorrect: 2,
        timedOut: 1,
        score: 0,
        percentage: 0,
      },
    });
    expect(history.summary.records.map((record) => record.question.id)).toEqual(["q1", "q2"]);
  });
});
