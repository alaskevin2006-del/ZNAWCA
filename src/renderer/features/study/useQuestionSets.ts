import { useMemo } from "react";
import type { Course } from "../../../core/course/types";
import {
  buildCourseQuestionSet,
  type CourseQuestionSet,
} from "../../../core/quiz/question-set";
import type { FilterSelection, QuestionKind } from "../../../core/quiz/types";
import type { LocalState } from "../../../contracts/local-state";
import { directionLabels } from "../../i18n/study";
import type { EnabledDirections, EnabledKinds } from "./types";

export function useQuestionSets(
  activeCourse: Course | undefined,
  filters: FilterSelection[],
  strict: boolean,
  directions: EnabledDirections,
  kinds: EnabledKinds,
  localState: LocalState,
) {
  const questionSet = useMemo(() => {
    if (!activeCourse) return emptySet;
    const selectedDirections = directionLabels
      .filter(([key]) => directions[key])
      .map(([key]) => key);
    const requestedKinds = (Object.keys(kinds) as QuestionKind[]).filter(
      (key) => kinds[key],
    );
    return buildCourseQuestionSet({
      course: activeCourse,
      selections: filters,
      teachingStyle: strict ? "strict" : "lenient",
      directions: selectedDirections,
      requestedKinds,
      recentMediaPaths: [
        ...(localState.mediaHistory[activeCourse.id] ?? []),
        ...localState.knowledgeProgress
          .filter((record) => record.courseId === activeCourse.id)
          .flatMap((record) => record.seenMediaPaths),
      ],
    });
  }, [
    activeCourse,
    directions,
    filters,
    kinds,
    strict,
    localState.mediaHistory,
    localState.knowledgeProgress,
  ]);
  const capabilitySet = useMemo(() => {
    if (!activeCourse) return emptySet;
    return buildCourseQuestionSet({
      course: activeCourse,
      selections: filters,
      teachingStyle: strict ? "strict" : "lenient",
      directions: directionLabels.map(([key]) => key),
      requestedKinds: ["input", "choice"],
      recentMediaPaths: [
        ...(localState.mediaHistory[activeCourse.id] ?? []),
        ...localState.knowledgeProgress
          .filter((record) => record.courseId === activeCourse.id)
          .flatMap((record) => record.seenMediaPaths),
      ],
    });
  }, [
    activeCourse,
    filters,
    strict,
    localState.mediaHistory,
    localState.knowledgeProgress,
  ]);
  const reviewQuestionSet = useMemo(() => {
    if (!activeCourse) return emptySet;
    return buildCourseQuestionSet({
      course: activeCourse,
      selections: [],
      teachingStyle: strict ? "strict" : "lenient",
      directions: directionLabels.map(([key]) => key),
      requestedKinds: ["input", "choice"],
      recentMediaPaths: [
        ...(localState.mediaHistory[activeCourse.id] ?? []),
        ...localState.knowledgeProgress
          .filter((record) => record.courseId === activeCourse.id)
          .flatMap((record) => record.seenMediaPaths),
      ],
    });
  }, [
    activeCourse,
    strict,
    localState.mediaHistory,
    localState.knowledgeProgress,
  ]);

  return { questionSet, capabilitySet, reviewQuestionSet };
}

export const emptySet: CourseQuestionSet = {
  questions: [],
  skipped: [],
  skippedFields: [],
  availability: {
    generated: 0,
    input: 0,
    choice: 0,
    degraded: 0,
    skipped: 0,
    byDirection: {},
  },
};
