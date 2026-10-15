import { isLocale } from "../../core/shared/locale.js";
import type {
  CourseCatalogEntry,
  CourseIssue,
} from "../../core/course/types.js";
import { type KnowledgeProgressRecord } from "../../core/progress/knowledge-progress.js";
import type {
  LearningHistoryRecord,
  LearningSessionRecord,
  TestHistoryRecord,
} from "../../core/session/session-controller.js";
import { LocalState } from "../../contracts/local-state.js";

export const timers = [0, 10, 15, 20];

/**
 * Parses all persisted schemas from the original v1 through the current v7. Invalid optional
 * collections are discarded independently so one damaged history entry cannot
 * erase otherwise valid settings and progress.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSettings(value: unknown): value is LocalState["settings"] {
  if (!isRecord(value)) return false;
  return (
    isLocale(value.locale) &&
    typeof value.strictDistractors === "boolean" &&
    typeof value.timerSeconds === "number" &&
    timers.includes(value.timerSeconds)
  );
}

export function isBooleanRecord(
  value: unknown,
): value is Record<string, boolean> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean")
  );
}

export function finiteInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function isDemoState(value: unknown): value is LocalState["demo"] {
  return (
    isRecord(value) &&
    typeof value.completed === "boolean" &&
    typeof value.step === "number" &&
    Number.isFinite(value.step)
  );
}

export function isCourseIssue(value: unknown): value is CourseIssue {
  if (!isRecord(value)) return false;
  const location = value.location;
  if (!isRecord(location) || typeof location.file !== "string") return false;
  return (
    (value.severity === "error" || value.severity === "warning") &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.suggestion === "string"
  );
}

export function isCourseCatalogEntry(
  value: unknown,
): value is CourseCatalogEntry {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (typeof value.title !== "string" || typeof value.directory !== "string")
    return false;
  if (
    !Array.isArray(value.workbookPaths) ||
    !value.workbookPaths.every((entry) => typeof entry === "string")
  )
    return false;
  if (
    value.languageCode !== undefined &&
    typeof value.languageCode !== "string"
  )
    return false;
  if (!Array.isArray(value.issues) || !value.issues.every(isCourseIssue))
    return false;
  return typeof value.canOpen === "boolean";
}

export function isLearningSessionRecord(
  value: unknown,
): value is LearningSessionRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    typeof value.courseId === "string" &&
    typeof value.courseTitle === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.savedAt === "string" &&
    isRecord(value.scope) &&
    isRecord(value.progress) &&
    Array.isArray(value.progress.queue) &&
    Array.isArray(value.progress.completedQuestionIds)
  );
}

export function isTestHistoryRecord(
  value: unknown,
): value is TestHistoryRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    typeof value.courseId === "string" &&
    typeof value.courseTitle === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.timerSeconds === "number" &&
    timers.includes(value.timerSeconds) &&
    isRecord(value.scope) &&
    isRecord(value.summary) &&
    Array.isArray(value.summary.records)
  );
}

export function isLearningHistoryRecord(
  value: unknown,
): value is LearningHistoryRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    typeof value.courseId === "string" &&
    typeof value.courseTitle === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.questionCount === "number" &&
    typeof value.attemptCount === "number" &&
    isRecord(value.scope) &&
    Array.isArray(value.records)
  );
}

export function isKnowledgeProgressRecord(
  value: unknown,
): value is KnowledgeProgressRecord {
  return (
    isRecord(value) &&
    typeof value.courseId === "string" &&
    typeof value.objectId === "string" &&
    typeof value.projectId === "string" &&
    typeof value.exposureCount === "number" &&
    typeof value.correctCount === "number" &&
    typeof value.incorrectCount === "number" &&
    typeof value.mastered === "boolean" &&
    typeof value.lastSeenAt === "string" &&
    Array.isArray(value.seenQuestionIds) &&
    value.seenQuestionIds.every((entry) => typeof entry === "string") &&
    Array.isArray(value.seenMediaPaths) &&
    value.seenMediaPaths.every((entry) => typeof entry === "string")
  );
}
