import { isLocale, type Locale } from "../localization/index.js";
import type { DifficultyRecord } from "../difficulty/difficulty-memory.js";
import { updateKnowledgeProgress, type KnowledgeProgressRecord } from "../progress/knowledge-progress.js";
import type { LearningHistoryRecord, LearningSessionRecord, TestHistoryRecord } from "../session/session-controller.js";

export interface CourseProgress {
  readonly lastOpenedAt: string;
  readonly completedSessions: number;
}

export interface LocalState {
  version: 7;
  settings: {
    locale: Locale;
    strictDistractors: boolean;
    timerSeconds: 0 | 10 | 15 | 20;
    difficultFirst: boolean;
    courseRoot?: string;
    recentCourseId?: string;
    mode: "learning" | "testing";
    coverageMode: "all" | "sample";
    questionLimit: number;
    enabledKinds: { input: boolean; choice: boolean };
    enabledDirections: Record<string, boolean>;
    playerVolume: number;
    removedCourseIds: string[];
  };
  courses: Record<string, CourseProgress>;
  difficulty: Record<string, number>;
  difficultyRecords: DifficultyRecord[];
  demo: { completed: boolean; step: number };
  /** At most one resumable learning session is retained per course. */
  learningSessions: Record<string, LearningSessionRecord>;
  learningHistory: LearningHistoryRecord[];
  testHistory: TestHistoryRecord[];
  /** Recently presented media paths, retained per course to reduce repetition. */
  mediaHistory: Record<string, string[]>;
  /** Course-wide coverage and mastery, grouped by semantic knowledge project. */
  knowledgeProgress: KnowledgeProgressRecord[];
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const defaultLocalState = (): LocalState => ({
  version: 7,
  settings: {
    locale: "en",
    strictDistractors: true,
    timerSeconds: 0,
    difficultFirst: false,
    mode: "learning",
    coverageMode: "sample",
    questionLimit: 10,
    enabledKinds: { input: true, choice: true },
    enabledDirections: {},
    playerVolume: 1,
    removedCourseIds: [],
  },
  courses: {},
  difficulty: {},
  difficultyRecords: [],
  demo: { completed: false, step: 0 },
  learningSessions: {},
  learningHistory: [],
  testHistory: [],
  mediaHistory: {},
  knowledgeProgress: [],
});

const timers = [0, 10, 15, 20];

/**
 * Parses all persisted schemas from the original v1 through the current v7. Invalid optional
 * collections are discarded independently so one damaged history entry cannot
 * erase otherwise valid settings and progress.
 */
export function parseLocalState(raw: string | null): LocalState {
  if (!raw) return defaultLocalState();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (![1, 2, 3, 4, 5, 6, 7].includes(value.version as number) || !isSettings(value.settings)) {
      return defaultLocalState();
    }
    const settings = value.settings as Record<string, unknown>;
    const learningSessions = isRecord(value.learningSessions)
      ? Object.fromEntries(Object.entries(value.learningSessions).filter((entry): entry is [string, LearningSessionRecord] =>
        isLearningSessionRecord(entry[1])))
      : {};
    const learningHistory = Array.isArray(value.learningHistory)
      ? value.learningHistory.filter(isLearningHistoryRecord)
      : [];
    const testHistory = Array.isArray(value.testHistory)
      ? value.testHistory.filter(isTestHistoryRecord).map(normalizeBinaryTestHistory)
      : [];
    return {
      version: 7,
      settings: {
        locale: settings.locale as Locale,
        strictDistractors: settings.strictDistractors as boolean,
        timerSeconds: settings.timerSeconds as 0 | 10 | 15 | 20,
        difficultFirst: typeof settings.difficultFirst === "boolean" ? settings.difficultFirst : false,
        ...(typeof settings.courseRoot === "string" && settings.courseRoot ? { courseRoot: settings.courseRoot } : {}),
        ...(typeof settings.recentCourseId === "string" && settings.recentCourseId ? { recentCourseId: settings.recentCourseId } : {}),
        mode: settings.mode === "testing" ? "testing" : "learning",
        coverageMode: settings.coverageMode === "sample" ? "sample" : "all",
        questionLimit: finiteInRange(settings.questionLimit, 1, 10000, 10),
        enabledKinds: isBooleanRecord(settings.enabledKinds)
          ? { input: settings.enabledKinds.input !== false, choice: settings.enabledKinds.choice !== false }
          : { input: true, choice: true },
        enabledDirections: isBooleanRecord(settings.enabledDirections) ? settings.enabledDirections : {},
        playerVolume: finiteInRange(settings.playerVolume, 0, 1, 1),
        removedCourseIds: Array.isArray(settings.removedCourseIds)
          ? [...new Set(settings.removedCourseIds.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)))]
          : [],
      },
      courses: isRecord(value.courses) ? value.courses as Record<string, CourseProgress> : {},
      difficulty: {},
      difficultyRecords: migrateDifficultyRecords(value, learningSessions, learningHistory, testHistory),
      demo: isDemoState(value.demo) ? value.demo : { completed: false, step: 0 },
      learningSessions,
      learningHistory,
      testHistory,
      mediaHistory: isRecord(value.mediaHistory)
        ? Object.fromEntries(Object.entries(value.mediaHistory).filter((entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string")))
        : {},
      knowledgeProgress: Array.isArray(value.knowledgeProgress)
        ? value.knowledgeProgress.filter(isKnowledgeProgressRecord)
        : migrateKnowledgeProgress(learningHistory, testHistory),
    };
  } catch {
    return defaultLocalState();
  }
}

export function saveLearningSession(state: LocalState, session: LearningSessionRecord): LocalState {
  return {
    ...state,
    learningSessions: { ...state.learningSessions, [session.courseId]: session },
  };
}

export function removeLearningSession(state: LocalState, courseId: string): LocalState {
  const learningSessions = { ...state.learningSessions };
  delete learningSessions[courseId];
  return { ...state, learningSessions };
}

export function getLearningSession(state: LocalState, courseId: string): LearningSessionRecord | undefined {
  return state.learningSessions[courseId];
}

export function appendTestHistory(
  state: LocalState,
  record: TestHistoryRecord,
  maximumEntries = 500,
): LocalState {
  const limit = Math.max(1, Math.floor(maximumEntries));
  return { ...state, testHistory: [...state.testHistory, normalizeBinaryTestHistory(record)].slice(-limit) };
}

export function appendLearningHistory(
  state: LocalState,
  record: LearningHistoryRecord,
  maximumEntries = 500,
): LocalState {
  const limit = Math.max(1, Math.floor(maximumEntries));
  return { ...state, learningHistory: [...state.learningHistory, record].slice(-limit) };
}

export function rememberMedia(
  state: LocalState,
  courseId: string,
  paths: readonly string[],
  maximumEntries = 24,
): LocalState {
  const existing = state.mediaHistory[courseId] ?? [];
  const unique = [...new Set([...existing, ...paths].filter(Boolean))];
  return {
    ...state,
    mediaHistory: {
      ...state.mediaHistory,
      [courseId]: unique.slice(-Math.max(1, Math.floor(maximumEntries))),
    },
  };
}

export function clearCourseData(state: LocalState, courseId: string): LocalState {
  const courses = { ...state.courses };
  const learningSessions = { ...state.learningSessions };
  const mediaHistory = { ...state.mediaHistory };
  const difficulty = Object.fromEntries(
    Object.entries(state.difficulty).filter(([key]) => !key.startsWith(`${courseId}:`)),
  );
  delete courses[courseId];
  delete learningSessions[courseId];
  delete mediaHistory[courseId];
  return {
    ...state,
    courses,
    learningSessions,
    mediaHistory,
    knowledgeProgress: state.knowledgeProgress.filter((record) => record.courseId !== courseId),
    difficulty,
    difficultyRecords: state.difficultyRecords.filter((record) => record.courseId !== courseId),
    learningHistory: state.learningHistory.filter((record) => record.courseId !== courseId),
    testHistory: state.testHistory.filter((record) => record.courseId !== courseId),
  };
}

export function clearCourseDifficulty(state: LocalState, courseId: string): LocalState {
  return {
    ...state,
    difficulty: Object.fromEntries(
      Object.entries(state.difficulty).filter(([key]) => !key.startsWith(`${courseId}:`)),
    ),
    difficultyRecords: state.difficultyRecords.filter((record) => record.courseId !== courseId),
  };
}

export function removeDifficultyRecord(
  state: LocalState,
  courseId: string,
  objectId: string,
): LocalState {
  const key = `${courseId}:${objectId}`;
  return {
    ...state,
    difficulty: Object.fromEntries(
      Object.entries(state.difficulty).filter(([entryKey]) => entryKey !== key),
    ),
    difficultyRecords: state.difficultyRecords.filter(
      (record) => !(record.courseId === courseId && record.objectId === objectId),
    ),
  };
}

export class LocalStateRepository {
  // Keep the original key so existing installations are migrated in place.
  static readonly key = "znawca.local-state.v1";
  constructor(private readonly store: KeyValueStore) {}
  load(): LocalState { return parseLocalState(this.store.getItem(LocalStateRepository.key)); }
  save(state: LocalState): void { this.store.setItem(LocalStateRepository.key, JSON.stringify(state)); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSettings(value: unknown): value is LocalState["settings"] {
  if (!isRecord(value)) return false;
  return isLocale(value.locale) && typeof value.strictDistractors === "boolean" &&
    typeof value.timerSeconds === "number" && timers.includes(value.timerSeconds);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function finiteInRange(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function isDemoState(value: unknown): value is LocalState["demo"] {
  return isRecord(value) && typeof value.completed === "boolean" &&
    typeof value.step === "number" && Number.isFinite(value.step);
}

function isLearningSessionRecord(value: unknown): value is LearningSessionRecord {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.id === "string" &&
    typeof value.courseId === "string" && typeof value.courseTitle === "string" &&
    typeof value.startedAt === "string" && typeof value.savedAt === "string" &&
    isRecord(value.scope) && isRecord(value.progress) && Array.isArray(value.progress.queue) &&
    Array.isArray(value.progress.completedQuestionIds);
}

function isTestHistoryRecord(value: unknown): value is TestHistoryRecord {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.id === "string" &&
    typeof value.courseId === "string" && typeof value.courseTitle === "string" &&
    typeof value.startedAt === "string" && typeof value.completedAt === "string" &&
    typeof value.timerSeconds === "number" && timers.includes(value.timerSeconds) &&
    isRecord(value.scope) && isRecord(value.summary) && Array.isArray(value.summary.records);
}

function isLearningHistoryRecord(value: unknown): value is LearningHistoryRecord {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.id === "string" &&
    typeof value.courseId === "string" && typeof value.courseTitle === "string" &&
    typeof value.startedAt === "string" && typeof value.completedAt === "string" &&
    typeof value.questionCount === "number" && typeof value.attemptCount === "number" &&
    isRecord(value.scope) && Array.isArray(value.records);
}

function normalizeBinaryTestHistory(record: TestHistoryRecord): TestHistoryRecord {
  const total = Number.isFinite(record.summary.total)
    ? Math.max(0, Math.floor(record.summary.total))
    : record.summary.records.length;
  const fullyCorrect = Number.isFinite(record.summary.fullyCorrect)
    ? Math.min(total, Math.max(0, Math.floor(record.summary.fullyCorrect)))
    : Math.min(total, record.summary.records.filter((entry) => entry.evaluation.fullyCorrect).length);
  return {
    ...record,
    summary: {
      ...record.summary,
      incorrect: Math.max(0, total - fullyCorrect),
      score: fullyCorrect,
      percentage: total === 0 ? 0 : fullyCorrect / total * 100,
    },
  };
}

function migrateDifficultyRecords(
  state: Record<string, unknown>,
  learningSessions: Readonly<Record<string, LearningSessionRecord>>,
  learningHistory: readonly LearningHistoryRecord[],
  testHistory: readonly TestHistoryRecord[],
): DifficultyRecord[] {
  const questionScopes = new Map<string, { courseId: string; objectId: string }>();
  const knownCourseIds = new Set<string>([
    ...Object.keys(isRecord(state.courses) ? state.courses : {}),
    ...Object.keys(learningSessions),
    ...learningHistory.map((entry) => entry.courseId),
    ...testHistory.map((entry) => entry.courseId),
  ]);
  const rememberQuestion = (courseId: string, question: unknown) => {
    if (!isRecord(question) || typeof question.id !== "string" || typeof question.objectId !== "string") return;
    knownCourseIds.add(courseId);
    questionScopes.set(question.id, { courseId, objectId: question.objectId });
  };
  for (const session of Object.values(learningSessions)) {
    for (const entry of session.progress.queue) rememberQuestion(session.courseId, entry.question);
    for (const entry of session.progress.records ?? []) rememberQuestion(session.courseId, entry.question);
  }
  for (const history of learningHistory) {
    for (const entry of history.records) rememberQuestion(history.courseId, entry.question);
  }
  for (const history of testHistory) {
    for (const entry of history.summary.records) rememberQuestion(history.courseId, entry.question);
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
        consecutiveCorrect: failed ? 0 : Math.min(1, Math.max(0, consecutiveCorrect)),
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
      merge(courseId, key.slice(courseId.length + 1).split(":")[0] ?? "", 0, true);
      return;
    }
    const [fallbackCourseId = "", fallbackObjectId = ""] = key.split(":");
    merge(fallbackCourseId, fallbackObjectId, 0, true);
  };

  if (Array.isArray(state.difficultyRecords)) {
    for (const record of state.difficultyRecords) {
      if (!isRecord(record)) continue;
      if (typeof record.courseId === "string" && typeof record.objectId === "string" &&
          typeof record.projectId === "string" && record.difficult === true &&
          (record.level === "risk" || record.level === "difficult" || record.level === "frequent")) {
        merge(record.courseId, record.objectId, 0, true);
      } else if (typeof record.courseId === "string" && typeof record.objectId === "string" &&
          typeof record.consecutiveCorrect === "number") {
        merge(record.courseId, record.objectId, record.consecutiveCorrect, false);
      } else if (typeof record.courseId === "string" && typeof record.objectId === "string" &&
          record.difficult === true) {
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

function migrateKnowledgeProgress(
  learningHistory: readonly LearningHistoryRecord[],
  testHistory: readonly TestHistoryRecord[],
): KnowledgeProgressRecord[] {
  let records: KnowledgeProgressRecord[] = [];
  for (const history of learningHistory) {
    records = updateKnowledgeProgress(records, history.courseId, history.records, "learning", history.completedAt);
  }
  for (const history of testHistory) {
    records = updateKnowledgeProgress(records, history.courseId, history.summary.records, "testing", history.completedAt);
  }
  return records;
}

function isKnowledgeProgressRecord(value: unknown): value is KnowledgeProgressRecord {
  return isRecord(value) && typeof value.courseId === "string" && typeof value.objectId === "string" &&
    typeof value.projectId === "string" && typeof value.exposureCount === "number" &&
    typeof value.correctCount === "number" && typeof value.incorrectCount === "number" &&
    typeof value.mastered === "boolean" && typeof value.lastSeenAt === "string" &&
    Array.isArray(value.seenQuestionIds) && value.seenQuestionIds.every((entry) => typeof entry === "string") &&
    Array.isArray(value.seenMediaPaths) && value.seenMediaPaths.every((entry) => typeof entry === "string");
}
