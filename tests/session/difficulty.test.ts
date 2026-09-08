import { describe, expect, it } from "vitest";
import { DifficultyMemory, weightedSampleByObject } from "../../src/core/difficulty/difficulty-memory.js";

const scope = { courseId: "countries", objectId: "australia" };

/** A deterministic LCG so probability tests are reproducible. */
const lcg = (seed: number) => {
  let state = seed;
  return { next: () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; } };
};

describe("difficulty memory", () => {
  it("creates a difficulty record on first failure", () => {
    const memory = new DifficultyMemory();
    memory.completeSession([
      { ...scope, score: 0 },
      { ...scope, score: 1 },
    ]);
    const record = memory.get(scope.courseId, scope.objectId);
    expect(record).toEqual({ ...scope, consecutiveCorrect: 0 });
    expect(memory.snapshot()).toHaveLength(1);
  });

  it("removes the record after two fully correct sessions in which the object appeared", () => {
    const memory = new DifficultyMemory();
    memory.completeSession([{ ...scope, score: 0 }]);
    expect(memory.get(scope.courseId, scope.objectId)).toBeDefined();

    memory.completeSession([{ ...scope, score: 1 }]);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(1);
    memory.completeSession([{ ...scope, score: 1 }]);
    expect(memory.get(scope.courseId, scope.objectId)).toBeUndefined();
  });

  it("resets consecutive correct on a new failure", () => {
    const memory = new DifficultyMemory();
    memory.completeSession([{ ...scope, score: 0 }]);
    memory.completeSession([{ ...scope, score: 1 }]);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(1);

    memory.completeSession([{ ...scope, score: 0 }]);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(0);
  });

  it("collapses all aspects of one object into a single difficulty record", () => {
    const memory = new DifficultyMemory();
    // The same object appears through several attributes/media in one session:
    // D-10 requires exactly one object-level record.
    memory.completeSession([
      { ...scope, score: 0 },
      { ...scope, score: 1 },
    ]);
    expect(memory.snapshot()).toHaveLength(1);
    expect(memory.get(scope.courseId, scope.objectId)).toEqual({ ...scope, consecutiveCorrect: 0 });
  });

  it("summarizes multiple errors in one session once and resets recovery", () => {
    const memory = new DifficultyMemory([{ ...scope, consecutiveCorrect: 1 }]);
    memory.completeSession([
      { ...scope, score: 1 },
      { ...scope, score: 0 },
      { ...scope, score: 0 },
    ]);
    expect(memory.snapshot()).toHaveLength(1);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(0);
  });

  it("counts one recovery step per fully correct session, not per attempt", () => {
    const memory = new DifficultyMemory([{ ...scope, consecutiveCorrect: 1 }]);
    memory.completeSession([
      { ...scope, score: 1 },
      { ...scope, score: 1 },
      { ...scope, score: 1 },
    ]);
    // 1 + 1 (one session) = 2 -> cleared. Counting attempts would reach 4.
    expect(memory.get(scope.courseId, scope.objectId)).toBeUndefined();
  });

  it("does not count sessions where the object did not appear", () => {
    const memory = new DifficultyMemory([{ ...scope, consecutiveCorrect: 1 }]);
    memory.completeSession([{ courseId: "countries", objectId: "canada", score: 1 }]);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(1);
    memory.completeSession([]);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(1);
  });

  it("does not let another object's error affect this object", () => {
    const memory = new DifficultyMemory([{ ...scope, consecutiveCorrect: 0 }]);
    memory.completeSession([
      { ...scope, score: 1 },
      { courseId: "countries", objectId: "canada", score: 0 },
    ]);
    expect(memory.get(scope.courseId, scope.objectId)?.consecutiveCorrect).toBe(1);
    // canada's own error created its own record but did not reset australia.
    expect(memory.get("countries", "canada")?.consecutiveCorrect).toBe(0);
  });

  it("keeps the same object id independent across different courses", () => {
    const memory = new DifficultyMemory();
    // australia fails in course "countries" — creates a countries-scoped record.
    memory.completeSession([{ courseId: "countries", objectId: "australia", score: 0 }]);
    expect(memory.get("countries", "australia")).toBeDefined();
    // The same object id in a different course must not inherit that record.
    expect(memory.get("biology", "australia")).toBeUndefined();

    // A failure in "biology" creates its own record and must not affect "countries".
    memory.completeSession([{ courseId: "biology", objectId: "australia", score: 0 }]);
    expect(memory.get("countries", "australia")?.consecutiveCorrect).toBe(0);
    expect(memory.get("biology", "australia")?.consecutiveCorrect).toBe(0);

    // Recovering in "countries" clears only the countries record, leaving biology intact.
    memory.completeSession([{ courseId: "countries", objectId: "australia", score: 1 }]);
    memory.completeSession([{ courseId: "countries", objectId: "australia", score: 1 }]);
    expect(memory.get("countries", "australia")).toBeUndefined();
    expect(memory.get("biology", "australia")).toBeDefined();
  });

  it("uses fixed difficulty selection weight", () => {
    const memory = new DifficultyMemory([
      { ...scope, consecutiveCorrect: 0 },
    ]);
    expect(memory.selectionWeight(scope.courseId, scope.objectId)).toBe(2);
    expect(memory.selectionWeight(scope.courseId, "canada")).toBe(1);
  });

  it("selects at most one variant from each object per round", () => {
    const values = [
      { id: "flag-forward", objectId: "australia" },
      { id: "flag-reverse", objectId: "australia" },
      { id: "capital-forward", objectId: "canada" },
    ];
    const scopeOf = (value: { id: string; objectId: string }) => ({ courseId: "countries", objectId: value.objectId });
    const selected = weightedSampleByObject(
      values,
      3,
      scopeOf,
      new DifficultyMemory(),
      { next: () => 0 },
    );
    // australia's two variants land in different rounds (round 1 and round 3),
    // separated by canada's round 2 contribution: one variant per object per round.
    expect(selected.map((value) => value.id)).toEqual(["flag-forward", "capital-forward", "flag-reverse"]);
  });

  it("does not boost an object because it has more variants", () => {
    // australia is difficult with a single variant; canada is normal but has
    // three variants. Weighted object sampling must still favor australia 2:1.
    const memory = new DifficultyMemory([{ ...scope, consecutiveCorrect: 0 }]);
    const values = [
      { id: "australia-a", objectId: "australia" },
      { id: "canada-a", objectId: "canada" },
      { id: "canada-b", objectId: "canada" },
      { id: "canada-c", objectId: "canada" },
    ];
    const random = lcg(20260813);
    let australia = 0;
    const runs = 4000;
    for (let index = 0; index < runs; index += 1) {
      const selected = weightedSampleByObject(values, 1, (value) => ({ courseId: "countries", objectId: value.objectId }), memory, random);
      if (selected[0]?.objectId === "australia") australia += 1;
    }
    const ratio = australia / runs;
    expect(ratio).toBeGreaterThan(0.60);
    expect(ratio).toBeLessThan(0.72);
  });

  it("treats a multi-part answer with extras as not fully correct even when score is 1", () => {
    const memory = new DifficultyMemory();
    memory.completeSession([{ ...scope, score: 1, fullyCorrect: false }]);
    expect(memory.get(scope.courseId, scope.objectId)).toBeDefined();
  });

  it("treats a fully correct answer as correct regardless of the legacy score check", () => {
    const memory = new DifficultyMemory([{ ...scope, consecutiveCorrect: 1 }]);
    memory.completeSession([{ ...scope, score: 0.5, fullyCorrect: true }]);
    // fullyCorrect wins: the session counts as a clean one (1 -> 2) and the
    // record is cleared. A score-based check would have reset it to 0 instead.
    expect(memory.get(scope.courseId, scope.objectId)).toBeUndefined();
  });
});
