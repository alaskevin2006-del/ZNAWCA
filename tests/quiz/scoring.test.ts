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

describe("batch S2 acceptance (D-20): explicit aliases", () => {
  const expected = ["China/PRC", "Asia"];

  it("accepts any single declared alias per required group", () => {
    expect(evaluateAnswer(expected, "China; Asia")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(expected, "PRC; Asia")).toMatchObject({ score: 1, fullyCorrect: true });
  });

  it("accepts submitting several declared aliases of the same group", () => {
    expect(evaluateAnswer(expected, "China; PRC; Asia")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(expected, "China/PRC; Asia")).toMatchObject({ score: 1, fullyCorrect: true });
  });

  it("reports partial and wrong alias submissions", () => {
    expect(evaluateAnswer(expected, "China")).toMatchObject({ score: 0.5, fullyCorrect: false, missed: ["Asia"] });
    expect(evaluateAnswer(expected, "China; Africa")).toMatchObject({ fullyCorrect: false, extra: ["Africa"] });
  });

  it("does not split a slash group into two required answers", () => {
    expect(evaluateAnswer(["A/B"], "A")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(["A/B"], "B")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(["A/B"], "A; B")).toMatchObject({ score: 1, fullyCorrect: true });
    expect(evaluateAnswer(["A/B"], "A; C")).toMatchObject({ fullyCorrect: false, extra: ["C"] });
    expect(evaluateAnswer(["A/B"], "A/B")).toMatchObject({ score: 1, fullyCorrect: true });
  });

  it("keeps alias matching case- and whitespace-insensitive", () => {
    expect(evaluateAnswer(["China/PRC", "Asia"], "prc ; asia ")).toMatchObject({ score: 1, fullyCorrect: true });
  });

  it("keeps media path answers atomic despite their slashes", () => {
    const expected = ["znawca-media://asset/alpha.jpg"];
    expect(evaluateAnswer(expected, "znawca-media://asset/alpha.jpg").fullyCorrect).toBe(true);
    expect(evaluateAnswer(expected, "znawca-media://asset/bravo.jpg").fullyCorrect).toBe(false);
    expect(evaluateAnswer(["media/flag.png"], "media/flag.png").fullyCorrect).toBe(true);
    expect(evaluateAnswer(["media/flag.png"], "media/other.png").fullyCorrect).toBe(false);
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
