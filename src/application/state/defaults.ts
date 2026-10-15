import { LocalState } from "../../contracts/local-state.js";

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
    dismissedIssueKeys: [],
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
