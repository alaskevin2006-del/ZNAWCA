import type {
  LearningHistoryRecord,
  LearningSessionRecord,
  TestHistoryRecord,
} from "../../core/session/session-controller.js";
import { normalizeBinaryTestHistory } from "./history.js";
import { LocalState } from "../../contracts/local-state.js";

export function saveLearningSession(
  state: LocalState,
  session: LearningSessionRecord,
): LocalState {
  return {
    ...state,
    learningSessions: {
      ...state.learningSessions,
      [session.courseId]: session,
    },
  };
}

export function removeLearningSession(
  state: LocalState,
  courseId: string,
): LocalState {
  const learningSessions = { ...state.learningSessions };
  delete learningSessions[courseId];
  return { ...state, learningSessions };
}

export function getLearningSession(
  state: LocalState,
  courseId: string,
): LearningSessionRecord | undefined {
  return state.learningSessions[courseId];
}

export function appendTestHistory(
  state: LocalState,
  record: TestHistoryRecord,
  maximumEntries = 500,
): LocalState {
  const limit = Math.max(1, Math.floor(maximumEntries));
  return {
    ...state,
    testHistory: [
      ...state.testHistory,
      normalizeBinaryTestHistory(record),
    ].slice(-limit),
  };
}

export function appendLearningHistory(
  state: LocalState,
  record: LearningHistoryRecord,
  maximumEntries = 500,
): LocalState {
  const limit = Math.max(1, Math.floor(maximumEntries));
  return {
    ...state,
    learningHistory: [...state.learningHistory, record].slice(-limit),
  };
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

export function clearCourseData(
  state: LocalState,
  courseId: string,
): LocalState {
  const courses = { ...state.courses };
  const learningSessions = { ...state.learningSessions };
  const mediaHistory = { ...state.mediaHistory };
  const difficulty = Object.fromEntries(
    Object.entries(state.difficulty).filter(
      ([key]) => !key.startsWith(`${courseId}:`),
    ),
  );
  delete courses[courseId];
  delete learningSessions[courseId];
  delete mediaHistory[courseId];
  return {
    ...state,
    courses,
    learningSessions,
    mediaHistory,
    knowledgeProgress: state.knowledgeProgress.filter(
      (record) => record.courseId !== courseId,
    ),
    difficulty,
    difficultyRecords: state.difficultyRecords.filter(
      (record) => record.courseId !== courseId,
    ),
    learningHistory: state.learningHistory.filter(
      (record) => record.courseId !== courseId,
    ),
    testHistory: state.testHistory.filter(
      (record) => record.courseId !== courseId,
    ),
  };
}

export function clearCourseDifficulty(
  state: LocalState,
  courseId: string,
): LocalState {
  return {
    ...state,
    difficulty: Object.fromEntries(
      Object.entries(state.difficulty).filter(
        ([key]) => !key.startsWith(`${courseId}:`),
      ),
    ),
    difficultyRecords: state.difficultyRecords.filter(
      (record) => record.courseId !== courseId,
    ),
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
      (record) =>
        !(record.courseId === courseId && record.objectId === objectId),
    ),
  };
}
