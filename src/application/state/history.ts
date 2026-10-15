import type { TestHistoryRecord } from "../../core/session/session-controller.js";

export function normalizeBinaryTestHistory(
  record: TestHistoryRecord,
): TestHistoryRecord {
  const total = Number.isFinite(record.summary.total)
    ? Math.max(0, Math.floor(record.summary.total))
    : record.summary.records.length;
  const fullyCorrect = Number.isFinite(record.summary.fullyCorrect)
    ? Math.min(total, Math.max(0, Math.floor(record.summary.fullyCorrect)))
    : Math.min(
        total,
        record.summary.records.filter((entry) => entry.evaluation.fullyCorrect)
          .length,
      );
  return {
    ...record,
    summary: {
      ...record.summary,
      incorrect: Math.max(0, total - fullyCorrect),
      score: fullyCorrect,
      percentage: total === 0 ? 0 : (fullyCorrect / total) * 100,
    },
  };
}
