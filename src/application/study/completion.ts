import type { LocalState } from "../../contracts/local-state.js";
import { DifficultyMemory } from "../../core/difficulty/difficulty-memory.js";
import { updateKnowledgeProgress } from "../../core/progress/knowledge-progress.js";
import type {
  LearningHistoryRecord,
  TestHistoryRecord,
} from "../../core/session/session-controller.js";
import {
  appendLearningHistory,
  appendTestHistory,
  removeLearningSession,
} from "../state/updates.js";

export function completeLearning(
  state: LocalState,
  history: LearningHistoryRecord,
): LocalState {
  if (state.learningHistory.some((entry) => entry.id === history.id))
    return state;
  const courseId = history.courseId;
  const memory = new DifficultyMemory(state.difficultyRecords);
  memory.completeSession(
    history.records.flatMap((entry) =>
      entry.question
        ? [
            {
              courseId,
              objectId: entry.question.objectId,
              score: entry.evaluation.score,
              fullyCorrect: entry.evaluation.fullyCorrect,
            },
          ]
        : [],
    ),
  );
  const cleaned = appendLearningHistory(
    removeLearningSession(state, courseId),
    history,
  );
  return {
    ...cleaned,
    courses: {
      ...cleaned.courses,
      [courseId]: {
        lastOpenedAt: history.completedAt,
        completedSessions:
          (cleaned.courses[courseId]?.completedSessions ?? 0) + 1,
      },
    },
    difficultyRecords: [...memory.snapshot()],
    knowledgeProgress: updateKnowledgeProgress(
      cleaned.knowledgeProgress,
      courseId,
      history.records,
      "learning",
      history.completedAt,
    ),
  };
}

export function completeTest(
  state: LocalState,
  history: TestHistoryRecord,
): LocalState {
  if (state.testHistory.some((entry) => entry.id === history.id)) return state;
  const memory = new DifficultyMemory(state.difficultyRecords);
  memory.completeSession(
    history.summary.records.map((entry) => ({
      courseId: history.courseId,
      objectId: entry.question.objectId,
      score: entry.evaluation.score,
      fullyCorrect: entry.evaluation.fullyCorrect,
    })),
  );
  const withHistory = appendTestHistory(state, history);
  return {
    ...withHistory,
    difficultyRecords: [...memory.snapshot()],
    knowledgeProgress: updateKnowledgeProgress(
      withHistory.knowledgeProgress,
      history.courseId,
      history.summary.records,
      "testing",
      history.completedAt,
    ),
  };
}
