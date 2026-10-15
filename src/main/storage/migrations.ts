import type { DifficultyRecord } from "../../core/difficulty/difficulty-memory.js";
import {
  updateKnowledgeProgress,
  type KnowledgeProgressRecord,
} from "../../core/progress/knowledge-progress.js";
import type {
  LearningHistoryRecord,
  LearningSessionRecord,
  TestHistoryRecord,
} from "../../core/session/session-controller.js";
import { isRecord } from "./validation.js";

export function migrateDifficultyRecords(
  state: Record<string, unknown>,
  learningSessions: Readonly<Record<string, LearningSessionRecord>>,
  learningHistory: readonly LearningHistoryRecord[],
  testHistory: readonly TestHistoryRecord[],
): DifficultyRecord[] {
  const questionScopes = new Map<
    string,
    { courseId: string; objectId: string }
  >();
  const knownCourseIds = new Set<string>([
    ...Object.keys(isRecord(state.courses) ? state.courses : {}),
    ...Object.keys(learningSessions),
    ...learningHistory.map((entry) => entry.courseId),
    ...testHistory.map((entry) => entry.courseId),
  ]);
  const rememberQuestion = (courseId: string, question: unknown) => {
    if (
      !isRecord(question) ||
      typeof question.id !== "string" ||
      typeof question.objectId !== "string"
    )
      return;
    knownCourseIds.add(courseId);
    questionScopes.set(question.id, { courseId, objectId: question.objectId });
  };
  for (const session of Object.values(learningSessions)) {
    for (const entry of session.progress.queue)
      rememberQuestion(session.courseId, entry.question);
    for (const entry of session.progress.records ?? [])
      rememberQuestion(session.courseId, entry.question);
  }
  for (const history of learningHistory) {
    for (const entry of history.records)
      rememberQuestion(history.courseId, entry.question);
  }
  for (const history of testHistory) {
    for (const entry of history.summary.records)
      rememberQuestion(history.courseId, entry.question);
  }

  // Difficulty is keyed by course + object row (D-10): several fragmented
  // records for the same object collapse into a single object-level record so
  // old data cannot keep competing records that would double the weight.
  // Recovery counters from the old 3-session era are clamped to 0..1.
  const migrated = new Map<string, DifficultyRecord>();
  const merge = (
    courseId: string,
    objectId: string,
    consecutiveCorrect = 0,
    failed = false,
  ) => {
    if (!courseId || !objectId) return;
    const key = JSON.stringify([courseId, objectId]);
    const existing = migrated.get(key);
    if (!existing) {
      migrated.set(key, {
        courseId,
        objectId,
        consecutiveCorrect: failed
          ? 0
          : Math.min(1, Math.max(0, consecutiveCorrect)),
      });
    } else if (failed) {
      migrated.set(key, { ...existing, consecutiveCorrect: 0 });
    }
  };
  const migrateLegacyKey = (key: string) => {
    const exact = questionScopes.get(key);
    if (exact) {
      merge(exact.courseId, exact.objectId, 0, true);
      return;
    }
    const courseId = [...knownCourseIds]
      .filter((candidate) => key.startsWith(`${candidate}:`))
      .sort((left, right) => right.length - left.length)[0];
    if (courseId) {
      merge(
        courseId,
        key.slice(courseId.length + 1).split(":")[0] ?? "",
        0,
        true,
      );
      return;
    }
    const [fallbackCourseId = "", fallbackObjectId = ""] = key.split(":");
    merge(fallbackCourseId, fallbackObjectId, 0, true);
  };

  if (Array.isArray(state.difficultyRecords)) {
    for (const record of state.difficultyRecords) {
      if (!isRecord(record)) continue;
      if (
        typeof record.courseId === "string" &&
        typeof record.objectId === "string" &&
        typeof record.projectId === "string" &&
        record.difficult === true &&
        (record.level === "risk" ||
          record.level === "difficult" ||
          record.level === "frequent")
      ) {
        merge(record.courseId, record.objectId, 0, true);
      } else if (
        typeof record.courseId === "string" &&
        typeof record.objectId === "string" &&
        typeof record.consecutiveCorrect === "number"
      ) {
        merge(
          record.courseId,
          record.objectId,
          record.consecutiveCorrect,
          false,
        );
      } else if (
        typeof record.courseId === "string" &&
        typeof record.objectId === "string" &&
        record.difficult === true
      ) {
        merge(record.courseId, record.objectId, 0, true);
      } else if (typeof record.key === "string" && record.difficult === true) {
        migrateLegacyKey(record.key);
      }
    }
  }
  if (isRecord(state.difficulty)) {
    for (const [key, weight] of Object.entries(state.difficulty)) {
      if (typeof weight === "number" && weight > 1) migrateLegacyKey(key);
    }
  }
  return [...migrated.values()];
}

export function migrateKnowledgeProgress(
  learningHistory: readonly LearningHistoryRecord[],
  testHistory: readonly TestHistoryRecord[],
): KnowledgeProgressRecord[] {
  let records: KnowledgeProgressRecord[] = [];
  for (const history of learningHistory) {
    records = updateKnowledgeProgress(
      records,
      history.courseId,
      history.records,
      "learning",
      history.completedAt,
    );
  }
  for (const history of testHistory) {
    records = updateKnowledgeProgress(
      records,
      history.courseId,
      history.summary.records,
      "testing",
      history.completedAt,
    );
  }
  return records;
}
