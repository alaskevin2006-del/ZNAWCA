import { describe, expect, it } from "vitest";
import {
  projectIdForQuestion,
  selectLearningQuestions,
  selectTestingQuestions,
  updateKnowledgeProgress,
  type KnowledgeProgressRecord,
} from "../../src/core/progress/knowledge-progress.js";
import type { Question } from "../../src/core/quiz/types.js";

const answer = { score: 1, fullyCorrect: true, matched: ["ok"], missed: [], extra: [] };
const question = (
  id: string,
  objectId: string,
  field: string,
  direction: Question["direction"] = "name-to-property",
): Question => ({
  id,
  objectId,
  field,
  direction,
  kind: "input",
  prompt: `${objectId} / ${field}`,
  acceptedAnswers: ["ok"],
});

describe("knowledge progress and scheduling", () => {
  it("treats direction and question kind as variants of one project", () => {
    const forward = question("forward", "australia", "Capital");
    const reverse = { ...question("reverse", "australia", "Capital", "property-to-name"), kind: "choice" as const };
    expect(projectIdForQuestion(forward)).toBe("field:Capital");
    expect(projectIdForQuestion(reverse)).toBe("field:Capital");
  });

  it("marks a completed learning project as mastered and retains detailed evidence", () => {
    const records = updateKnowledgeProgress([], "countries", [
      { question: question("q1", "australia", "Capital"), evaluation: answer, answeredAt: "2026-07-31T01:00:00.000Z" },
    ], "learning");
    expect(records).toEqual([
      expect.objectContaining({
        courseId: "countries",
        objectId: "australia",
        projectId: "field:Capital",
        mastered: true,
        exposureCount: 1,
        seenQuestionIds: ["q1"],
      }),
    ]);
  });

  it("continues learning with unseen projects instead of resampling mastered projects", () => {
    const questions = [
      question("capital", "australia", "Capital"),
      question("currency", "australia", "Currency"),
      question("capital-ca", "canada", "Capital"),
    ];
    const progress: KnowledgeProgressRecord[] = [{
      courseId: "countries",
      objectId: "australia",
      projectId: "field:Capital",
      exposureCount: 2,
      correctCount: 2,
      incorrectCount: 0,
      mastered: true,
      lastSeenAt: "2026-07-31T01:00:00.000Z",
      seenQuestionIds: ["capital"],
      seenMediaPaths: [],
    }];
    const selected = selectLearningQuestions(questions, 2, "countries", progress, [], false, { next: () => 0 });
    expect(selected.questions.map((entry) => entry.id).sort()).toEqual(["capital-ca", "currency"]);
    expect(selected.unseenProjects).toBe(2);
  });

  it("includes not-yet-mastered projects in testing", () => {
    const questions = [
      question("mastered", "australia", "Capital"),
      question("unseen", "australia", "Currency"),
    ];
    const progress: KnowledgeProgressRecord[] = [{
      courseId: "countries",
      objectId: "australia",
      projectId: "field:Capital",
      exposureCount: 1,
      correctCount: 1,
      incorrectCount: 0,
      mastered: true,
      lastSeenAt: "2026-07-31T01:00:00.000Z",
      seenQuestionIds: [],
      seenMediaPaths: [],
    }];
    const selected = selectTestingQuestions(questions, 10, "countries", progress, [], false, { next: () => 0 });
    expect(selected.questions.map((entry) => entry.id).sort()).toEqual(["mastered", "unseen"]);
    expect(selected.eligibleProjects).toBe(2);
  });

  it("does not repeat the same knowledge project within one test", () => {
    const questions = [
      question("capital-fwd", "australia", "Capital"),
      { ...question("capital-rev", "australia", "Capital", "property-to-name"), kind: "choice" as const },
      question("currency", "australia", "Currency"),
    ];
    const selected = selectTestingQuestions(questions, 10, "countries", [], [], false, { next: () => 0 });
    const projectIds = selected.questions.map((entry) => projectIdForQuestion(entry));
    expect(projectIds.filter((id) => id === "field:Capital")).toHaveLength(1);
    expect(selected.questions.map((entry) => entry.id).sort()).toEqual(["capital-fwd", "currency"]);
  });

  it("does not weight difficult objects when difficultFirst is off", () => {
    const questions = [
      question("hard", "australia", "Capital"),
      question("fresh", "canada", "Capital"),
    ];
    const progress: KnowledgeProgressRecord[] = [{
      courseId: "countries",
      objectId: "australia",
      projectId: "field:Capital",
      exposureCount: 99,
      correctCount: 0,
      incorrectCount: 99,
      mastered: false,
      lastSeenAt: "2026-07-31T01:00:00.000Z",
      seenQuestionIds: [],
      seenMediaPaths: [],
    }];
    const difficulty = [{ courseId: "countries", objectId: "australia", consecutiveCorrect: 0 }];
    const selected = selectLearningQuestions(questions, 1, "countries", progress, difficulty, false, { next: () => 0 });
    // Without weighting the unseen project is preferred despite australia being difficult.
    expect(selected.questions.map((entry) => entry.id)).toEqual(["fresh"]);
  });

  it("weights difficult objects 2:1 when difficultFirst is on", () => {
    const questions = [
      question("hard", "australia", "Capital"),
      question("normal", "canada", "Capital"),
    ];
    const difficulty = [{ courseId: "countries", objectId: "australia", consecutiveCorrect: 0 }];
    let seed = 12345;
    const random = { next: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; } };
    let hard = 0;
    const runs = 4000;
    for (let index = 0; index < runs; index += 1) {
      const selected = selectLearningQuestions(questions, 1, "countries", [], difficulty, true, random);
      if (selected.questions[0]?.objectId === "australia") hard += 1;
    }
    const ratio = hard / runs;
    expect(ratio).toBeGreaterThan(0.60);
    expect(ratio).toBeLessThan(0.72);
  });

  it("weights difficult objects 2:1 in testing too", () => {
    const questions = [
      question("hard", "australia", "Capital"),
      question("normal", "canada", "Capital"),
    ];
    const difficulty = [{ courseId: "countries", objectId: "australia", consecutiveCorrect: 0 }];
    let seed = 54321;
    const random = { next: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; } };
    let hard = 0;
    const runs = 4000;
    for (let index = 0; index < runs; index += 1) {
      const selected = selectTestingQuestions(questions, 1, "countries", [], difficulty, true, random);
      if (selected.questions[0]?.objectId === "australia") hard += 1;
    }
    const ratio = hard / runs;
    expect(ratio).toBeGreaterThan(0.60);
    expect(ratio).toBeLessThan(0.72);
  });
});
