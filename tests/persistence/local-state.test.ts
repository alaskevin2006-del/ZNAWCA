import { describe, expect, it } from "vitest";
import {
  LocalStateRepository,
  appendLearningHistory,
  appendTestHistory,
  clearCourseData,
  clearCourseDifficulty,
  defaultLocalState,
  getLearningSession,
  parseLocalState,
  rememberMedia,
  removeLearningSession,
  saveLearningSession,
} from "../../src/core/persistence";
import type { LearningHistoryRecord, LearningSessionRecord, TestHistoryRecord } from "../../src/core/session";

describe("local state", () => {
  it("recovers safely from corrupt or incompatible data", () => {
    expect(parseLocalState("not-json")).toEqual(defaultLocalState());
    expect(parseLocalState('{"version":3}')).toEqual(defaultLocalState());
  });
  it("migrates the original v1 state without losing user data", () => {
    const migrated = parseLocalState(JSON.stringify({
      version: 1,
      settings: { locale: "pl", strictDistractors: false, timerSeconds: 15 },
      courses: { birds: { lastOpenedAt: "2026-07-19T00:00:00.000Z", completedSessions: 2 } },
      difficulty: { q1: 3 },
      difficultyRecords: [],
      demo: { completed: true, step: 5 },
    }));
    expect(migrated).toMatchObject({
      version: 7,
      settings: { locale: "pl", strictDistractors: false, timerSeconds: 15, coverageMode: "all" },
      courses: { birds: { completedSessions: 2 } },
      learningSessions: {},
      learningHistory: [],
      testHistory: [],
    });
  });
  it("round trips settings, course progress and difficulty", () => {
    let value: string | null = null;
    const repository = new LocalStateRepository({ getItem: () => value, setItem: (_key, next) => { value = next; } });
    const state = defaultLocalState();
    state.settings.locale = "pl";
    state.courses.birds = { lastOpenedAt: "2026-07-19T00:00:00.000Z", completedSessions: 2 };
    state.difficultyRecords = [
      { courseId: "birds", objectId: "gull", consecutiveCorrect: 1 },
    ];
    repository.save(state);
    expect(repository.load()).toEqual(state);
  });

  it("updates resumable learning and bounded test history immutably", () => {
    const base = defaultLocalState();
    const learning = {
      schemaVersion: 1,
      id: "learn-1", courseId: "birds", courseTitle: "Birds",
      startedAt: "2026-07-30T01:00:00.000Z", savedAt: "2026-07-30T01:01:00.000Z",
      scope: { filters: [], selectedQuestionTypes: ["input"], requestedQuestionCount: 1, teachingStyle: "strict", difficultFirst: false },
      progress: { queue: [], completedQuestionIds: ["q1"], records: [] },
    } satisfies LearningSessionRecord;
    const withLearning = saveLearningSession(base, learning);
    expect(getLearningSession(withLearning, "birds")).toEqual(learning);
    expect(base.learningSessions).toEqual({});
    expect(getLearningSession(removeLearningSession(withLearning, "birds"), "birds")).toBeUndefined();

    const learningHistory = {
      schemaVersion: 1,
      id: "learn-1",
      courseId: "birds",
      courseTitle: "Birds",
      startedAt: "2026-07-30T01:00:00.000Z",
      completedAt: "2026-07-30T01:02:00.000Z",
      scope: learning.scope,
      questionCount: 1,
      attemptCount: 1,
      records: [],
    } satisfies LearningHistoryRecord;
    expect(appendLearningHistory(base, learningHistory).learningHistory).toEqual([learningHistory]);

    const history = {
      schemaVersion: 1,
      id: "test-1", courseId: "birds", courseTitle: "Birds",
      startedAt: "2026-07-30T01:00:00.000Z", completedAt: "2026-07-30T01:02:00.000Z",
      scope: learning.scope, timerSeconds: 10,
      summary: { total: 1, answered: 1, fullyCorrect: 0, partiallyCorrect: 1, incorrect: 0, timedOut: 0, score: 0.5, percentage: 50, records: [] },
    } satisfies TestHistoryRecord;
    expect(appendTestHistory(base, history).testHistory[0]?.summary).toMatchObject({
      fullyCorrect: 0,
      partiallyCorrect: 1,
      incorrect: 1,
      score: 0,
      percentage: 0,
    });
  });

  it("migrates P1 settings and remembers a bounded, de-duplicated media history", () => {
    const migrated = parseLocalState(JSON.stringify({
      ...defaultLocalState(),
      version: 2,
      settings: {
        locale: "zh-CN",
        strictDistractors: true,
        timerSeconds: 10,
        difficultFirst: true,
        courseRoot: "C:/Courses",
      },
      mediaHistory: { birds: ["old.jpg"] },
    }));
    expect(migrated.settings).toMatchObject({
      locale: "zh-CN",
      difficultFirst: true,
      courseRoot: "C:/Courses",
      coverageMode: "all",
    });
    expect(rememberMedia(migrated, "birds", ["old.jpg", "new.jpg", "last.jpg"], 2).mediaHistory.birds)
      .toEqual(["new.jpg", "last.jpg"]);
  });

  it("clears only the selected course's local records", () => {
    const base = defaultLocalState();
    const state = {
      ...base,
      courses: {
        birds: { lastOpenedAt: "2026-07-30T00:00:00.000Z", completedSessions: 1 },
        rocks: { lastOpenedAt: "2026-07-30T00:00:00.000Z", completedSessions: 2 },
      },
      difficultyRecords: [
        { courseId: "birds", objectId: "q1", consecutiveCorrect: 0 },
        { courseId: "rocks", objectId: "q1", consecutiveCorrect: 0 },
      ],
      difficulty: { "birds:q1": 3, "rocks:q1": 2 },
      mediaHistory: { birds: ["bird.jpg"], rocks: ["rock.jpg"] },
    };
    const cleared = clearCourseData(state, "birds");
    expect(cleared.courses.birds).toBeUndefined();
    expect(cleared.mediaHistory.birds).toBeUndefined();
    expect(cleared.courses.rocks).toBeDefined();
    expect(cleared.difficulty).toEqual({ "rocks:q1": 2 });
    expect(cleared.difficultyRecords.map((entry) => `${entry.courseId}:${entry.objectId}`)).toEqual(["rocks:q1"]);
  });

  it("can clear course difficulty without deleting its progress or test history", () => {
    const state = defaultLocalState();
    state.courses.birds = { lastOpenedAt: "2026-07-30T00:00:00.000Z", completedSessions: 2 };
    state.difficulty = { "birds:q1": 3 };
    state.difficultyRecords = [{ courseId: "birds", objectId: "q1", consecutiveCorrect: 0 }];
    const cleared = clearCourseDifficulty(state, "birds");
    expect(cleared.difficulty).toEqual({});
    expect(cleared.difficultyRecords).toEqual([]);
    expect(cleared.courses.birds?.completedSessions).toBe(2);
  });

  it("migrates fragmented question-level difficulty into one record per object when history cannot identify the project", () => {
    const migrated = parseLocalState(JSON.stringify({
      ...defaultLocalState(),
      version: 5,
      courses: { birds: { lastOpenedAt: "2026-07-30T00:00:00.000Z", completedSessions: 1 } },
      difficulty: {},
      difficultyRecords: [
        { key: "birds:gull:food:name-to-property:input", weight: 4, difficult: true, consecutiveCleanSessions: 0 },
        { key: "birds:gull:habitat:property-to-name:choice", weight: 2, difficult: true, consecutiveCleanSessions: 1 },
        { key: "birds:tern:food:name-to-property:input", weight: 1, difficult: false, consecutiveCleanSessions: 0 },
      ],
    }));
    // Two fragmented gull records collapse into a single object-level record;
    // tern was not flagged difficult and produces nothing.
    expect(migrated.difficultyRecords).toEqual([
      { courseId: "birds", objectId: "gull", consecutiveCorrect: 0 },
    ]);
  });

  it("collapses competing per-project difficulty records into one object record", () => {
    const migrated = parseLocalState(JSON.stringify({
      ...defaultLocalState(),
      version: 7,
      courses: { birds: { lastOpenedAt: "2026-07-30T00:00:00.000Z", completedSessions: 1 } },
      difficulty: {},
      difficultyRecords: [
        { courseId: "birds", objectId: "gull", projectId: "field:Food", consecutiveCorrect: 2 },
        { courseId: "birds", objectId: "gull", projectId: "field:Habitat", consecutiveCorrect: 0 },
        { courseId: "birds", objectId: "tern", projectId: "media:image", consecutiveCorrect: 1 },
      ],
    }));
    expect(migrated.difficultyRecords).toEqual([
      { courseId: "birds", objectId: "gull", consecutiveCorrect: 1 },
      { courseId: "birds", objectId: "tern", consecutiveCorrect: 1 },
    ]);
  });
});
