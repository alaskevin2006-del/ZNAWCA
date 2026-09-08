import type { AnswerEvaluation } from "./types.js";
import { normalizeText } from "./types.js";

function uniqueNormalized(values: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) result.set(normalized, value.trim());
  }
  return result;
}

const ANSWER_DELIMITER = /[;；,，]/u;

/**
 * Splits a user-submitted answer on any of the accepted separators:
 * half/full-width semicolon and half/full-width comma. Slashes, colons and
 * other symbols are deliberately NOT separators (D-02 boundary). Excel
 * parsing keeps using half-width semicolons only.
 */
export function splitAnswer(value: string): string[] {
  return value.split(ANSWER_DELIMITER).map((part) => part.trim()).filter(Boolean);
}

export function evaluateAnswer(
  expected: readonly string[],
  submitted: string | readonly string[],
): AnswerEvaluation {
  const expectedMap = uniqueNormalized(expected);
  const submittedMap = uniqueNormalized(typeof submitted === "string" ? splitAnswer(submitted) : submitted);
  const matched = [...submittedMap.keys()].filter((answer) => expectedMap.has(answer));
  const missed = [...expectedMap.keys()].filter((answer) => !submittedMap.has(answer));
  const extra = [...submittedMap.keys()].filter((answer) => !expectedMap.has(answer));
  const score = expectedMap.size === 0 ? 0 : matched.length / expectedMap.size;
  return {
    score,
    fullyCorrect: missed.length === 0 && extra.length === 0 && expectedMap.size > 0,
    matched: matched.map((key) => expectedMap.get(key)!),
    missed: missed.map((key) => expectedMap.get(key)!),
    extra: extra.map((key) => submittedMap.get(key)!),
  };
}
