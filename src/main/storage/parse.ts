import { type Locale } from "../../core/shared/locale.js";
import type { LearningSessionRecord } from "../../core/session/session-controller.js";
import {
  finiteInRange,
  isBooleanRecord,
  isCourseCatalogEntry,
  isDemoState,
  isKnowledgeProgressRecord,
  isLearningHistoryRecord,
  isLearningSessionRecord,
  isRecord,
  isSettings,
  isTestHistoryRecord,
} from "./validation.js";
import { normalizeBinaryTestHistory } from "../../application/state/history.js";
import {
  migrateDifficultyRecords,
  migrateKnowledgeProgress,
} from "./migrations.js";
import { CourseProgress, LocalState } from "../../contracts/local-state.js";
import { defaultLocalState } from "../../application/state/defaults.js";

export function parseLocalState(raw: string | null): LocalState {
  if (!raw) return defaultLocalState();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      ![1, 2, 3, 4, 5, 6, 7].includes(value.version as number) ||
      !isSettings(value.settings)
    ) {
      return defaultLocalState();
    }
    const settings = value.settings as Record<string, unknown>;
    const learningSessions = isRecord(value.learningSessions)
      ? Object.fromEntries(
          Object.entries(value.learningSessions).filter(
            (entry): entry is [string, LearningSessionRecord] =>
              isLearningSessionRecord(entry[1]),
          ),
        )
      : {};
    const learningHistory = Array.isArray(value.learningHistory)
      ? value.learningHistory.filter(isLearningHistoryRecord)
      : [];
    const testHistory = Array.isArray(value.testHistory)
      ? value.testHistory
          .filter(isTestHistoryRecord)
          .map(normalizeBinaryTestHistory)
      : [];
    return {
      version: 7,
      settings: {
        locale: settings.locale as Locale,
        strictDistractors: settings.strictDistractors as boolean,
        timerSeconds: settings.timerSeconds as 0 | 10 | 15 | 20,
        difficultFirst:
          typeof settings.difficultFirst === "boolean"
            ? settings.difficultFirst
            : false,
        ...(typeof settings.courseRoot === "string" && settings.courseRoot
          ? { courseRoot: settings.courseRoot }
          : {}),
        ...(typeof settings.recentCourseId === "string" &&
        settings.recentCourseId
          ? { recentCourseId: settings.recentCourseId }
          : {}),
        ...(Array.isArray(settings.courseCatalogCache)
          ? {
              courseCatalogCache:
                settings.courseCatalogCache.filter(isCourseCatalogEntry),
            }
          : {}),
        mode: settings.mode === "testing" ? "testing" : "learning",
        coverageMode: settings.coverageMode === "sample" ? "sample" : "all",
        questionLimit: finiteInRange(settings.questionLimit, 1, 10000, 10),
        enabledKinds: isBooleanRecord(settings.enabledKinds)
          ? {
              input: settings.enabledKinds.input !== false,
              choice: settings.enabledKinds.choice !== false,
            }
          : { input: true, choice: true },
        enabledDirections: isBooleanRecord(settings.enabledDirections)
          ? settings.enabledDirections
          : {},
        playerVolume: finiteInRange(settings.playerVolume, 0, 1, 1),
        removedCourseIds: Array.isArray(settings.removedCourseIds)
          ? [
              ...new Set(
                settings.removedCourseIds.filter(
                  (entry): entry is string =>
                    typeof entry === "string" && Boolean(entry),
                ),
              ),
            ]
          : [],
        dismissedIssueKeys: Array.isArray(settings.dismissedIssueKeys)
          ? [
              ...new Set(
                settings.dismissedIssueKeys.filter(
                  (entry): entry is string =>
                    typeof entry === "string" && Boolean(entry),
                ),
              ),
            ]
          : [],
      },
      courses: isRecord(value.courses)
        ? (value.courses as Record<string, CourseProgress>)
        : {},
      difficulty: {},
      difficultyRecords: migrateDifficultyRecords(
        value,
        learningSessions,
        learningHistory,
        testHistory,
      ),
      demo: isDemoState(value.demo)
        ? value.demo
        : { completed: false, step: 0 },
      learningSessions,
      learningHistory,
      testHistory,
      mediaHistory: isRecord(value.mediaHistory)
        ? Object.fromEntries(
            Object.entries(value.mediaHistory).filter(
              (entry): entry is [string, string[]] =>
                Array.isArray(entry[1]) &&
                entry[1].every((item) => typeof item === "string"),
            ),
          )
        : {},
      knowledgeProgress: Array.isArray(value.knowledgeProgress)
        ? value.knowledgeProgress.filter(isKnowledgeProgressRecord)
        : migrateKnowledgeProgress(learningHistory, testHistory),
    };
  } catch {
    return defaultLocalState();
  }
}
