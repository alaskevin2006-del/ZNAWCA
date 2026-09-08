import { describe, expect, it } from "vitest";
import { evaluateAnswer, splitAnswer } from "../../src/core/quiz/scoring.js";
import { normalizeText } from "../../src/core/quiz/types.js";

describe("batch B acceptance: answer parsing", () => {
  it("splits user answers on all four accepted separators", () => {
    expect(splitAnswer("A; B")).toEqual(["A", "B"]);
    expect(splitAnswer("b，a")).toEqual(["b", "a"]);
    expect(splitAnswer(" A；B ")).toEqual(["A", "B"]);
    expect(splitAnswer("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("does not split on slashes, colons or other symbols", () => {
    expect(splitAnswer("A/B")).toEqual(["A/B"]);
    expect(splitAnswer("A:B")).toEqual(["A:B"]);
    expect(splitAnswer("A\\B")).toEqual(["A\\B"]);
  });
});

describe("batch B acceptance: set comparison and normalization", () => {
  it("accepts any order of every required part with no extras", () => {
    expect(evaluateAnswer(["A", "B"], "b，a")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(["A", "B"], " A；B ")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(["A", "B"], "B; A")).toMatchObject({ score: 1, fullyCorrect: true });
  });

  it("rejects missing, extra and wrong parts", () => {
    expect(evaluateAnswer(["A", "B"], "A")).toMatchObject({ score: 0.5, fullyCorrect: false, missed: ["B"] });
    expect(evaluateAnswer(["A", "B"], "A; B; C")).toMatchObject({ fullyCorrect: false, extra: ["C"] });
    expect(evaluateAnswer(["A", "B"], "A; X")).toMatchObject({ fullyCorrect: false, missed: ["B"], extra: ["X"] });
  });

  it("folds subscript digits but not superscripts or other characters", () => {
    expect(normalizeText("H₂O")).toBe(normalizeText("H2O"));
    expect(evaluateAnswer(["H2O"], "H₂O")).toMatchObject({ fullyCorrect: true });
    expect(evaluateAnswer(["Na₂SO₄"], "na2so4")).toMatchObject({ fullyCorrect: true });
    expect(normalizeText("x²")).not.toBe(normalizeText("x2"));
    expect(evaluateAnswer(["x2"], "x²")).toMatchObject({ fullyCorrect: false });
  });

  it("keeps other character differences exact", () => {
    expect(evaluateAnswer(["Cafe"], "café")).toMatchObject({ fullyCorrect: false });
    expect(evaluateAnswer(["a-b"], "a_b")).toMatchObject({ fullyCorrect: false });
  });

  it("normalizes case, leading/trailing and repeated whitespace", () => {
    expect(evaluateAnswer(["Fish  Worms"], "  fish worms ")).toMatchObject({ fullyCorrect: true });
  });
});
