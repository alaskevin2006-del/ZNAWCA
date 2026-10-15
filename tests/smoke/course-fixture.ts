import { vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { type LocalState } from "../../src/contracts/local-state.js";

export const smokeCourse: Course = {
  id: "smoke-course",
  title: "Smoke Course",
  directory: "C:/Courses/Smoke",
  workbookPath: "C:/Courses/Smoke/Smoke.xlsx",
  sheetName: "Sheet1",
  columns: [
    { index: 2, title: "Scientific name", displayTitle: "Scientific name", filterOnly: false },
    { index: 3, title: "Diet", displayTitle: "Diet", filterOnly: false },
  ],
  items: [
    { id: "cuckoo", name: "Common Cuckoo", sourceRow: 2, values: { "Scientific name": ["Cuculus canorus"], Diet: ["insects", "seeds", "nuts"] }, media: [] },
    { id: "skylark", name: "Eurasian Skylark", sourceRow: 3, values: { "Scientific name": ["Alauda arvensis"], Diet: ["grain"] }, media: [] },
    { id: "great-tit", name: "Great Tit", sourceRow: 4, values: { "Scientific name": ["Parus major"], Diet: ["beetles"] }, media: [] },
    { id: "blackbird", name: "Common Blackbird", sourceRow: 5, values: { "Scientific name": ["Turdus merula"], Diet: ["worms"] }, media: [] },
  ],
};

export const smallSmokeCourse: Course = {
  ...smokeCourse,
  id: "small-smoke-course",
  title: "Small Smoke Course",
  directory: "C:/Courses/Small",
  workbookPath: "C:/Courses/Small/Small.xlsx",
  columns: smokeCourse.columns.slice(0, 1),
  items: smokeCourse.items.slice(0, 2).map((item) => ({
    ...item,
    values: { "Scientific name": item.values["Scientific name"]! },
  })),
};

export function installSmokeCourse(state: LocalState = defaultLocalState(), course: Course = smokeCourse) {
  state.settings.courseRoot = "C:/Courses";
  const saveLocalState = vi.fn().mockResolvedValue(undefined);
  window.znawca = {
    chooseCourse: vi.fn(),
    scanCourseRoot: vi.fn().mockResolvedValue({
      rootDirectory: "C:/Courses",
      reports: [{ canOpen: true, issues: [], course }],
    }),
    loadLocalState: vi.fn().mockResolvedValue(state),
    saveLocalState,
  };
  return saveLocalState;
}

export function markCourseMastered(state: LocalState, course: Course): LocalState {
  const records = course.items.flatMap((item) => [
    ...course.columns
      .filter((column) => column.index > 1 && !column.filterOnly && (item.values[column.title]?.length ?? 0) > 0)
      .map((column) => ({ objectId: item.id, projectId: `field:${column.title}` })),
    ...[...new Set(item.media.map((asset) => asset.kind))]
      .map((kind) => ({ objectId: item.id, projectId: `media:${kind}` })),
  ]).map(({ objectId, projectId }) => ({
    courseId: course.id,
    objectId,
    projectId,
    exposureCount: 1,
    correctCount: 1,
    incorrectCount: 0,
    mastered: true,
    lastSeenAt: "2026-07-30T00:00:00.000Z",
    seenQuestionIds: [],
    seenMediaPaths: [],
  }));
  return { ...state, knowledgeProgress: records };
}
