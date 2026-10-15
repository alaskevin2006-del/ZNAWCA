import { describe, expect, it } from "vitest";
import { StudySession } from "../../src/application/study/study-session";
import { LocalStateStore } from "../../src/application/state/local-state-store";
import { defaultLocalState } from "../../src/application/state/defaults";
import type { Question } from "../../src/core/quiz/types";
import type { SessionIdentity } from "../../src/core/session/session-controller";

const question: Question = {
  id: "q",
  objectId: "object",
  kind: "input",
  direction: "name-to-property",
  prompt: "Name?",
  acceptedAnswers: ["answer"],
};
const identity: SessionIdentity = {
  id: "s",
  courseId: "c",
  courseTitle: "Course",
  startedAt: "2026-10-15T00:00:00Z",
  scope: {
    filters: [],
    selectedQuestionTypes: ["input"],
    requestedQuestionCount: 1,
    teachingStyle: "strict",
    difficultFirst: false,
  },
};
async function setup() {
  const store = new LocalStateStore({
    load: async () => defaultLocalState(),
    save: async () => {},
  });
  await store.initialize();
  return { store, session: new StudySession(store, () => 20000) };
}

describe("study application flow", () => {
  it("keeps the answered question visible and completes all records exactly once", async () => {
    const { store, session } = await setup();
    session.start(identity, [question], "learning", 0);
    session.submit("answer");
    expect(session.getSnapshot().question).toEqual(question);
    expect(session.getSnapshot().units?.completed).toBe(1);
    expect(store.getSnapshot().state.learningHistory).toHaveLength(0);
    session.next();
    session.next();
    expect(session.getSnapshot().phase).toBe("results");
    const state = store.getSnapshot().state;
    expect(state.learningHistory).toHaveLength(1);
    expect(state.courses.c.completedSessions).toBe(1);
    expect(state.knowledgeProgress).toHaveLength(1);
    expect(state.difficultyRecords).toHaveLength(0);
  });

  it("preserves a retry queue through save/resume and marks testing errors difficult", async () => {
    const { store, session } = await setup();
    session.start(identity, [question], "learning", 0);
    session.submit("wrong");
    session.save();
    const saved = store.getSnapshot().state.learningSessions.c;
    session.resume(saved);
    expect(session.getSnapshot().question?.id).toBe("q");
    expect(session.getSnapshot().feedback).toBeUndefined();
    session.start({ ...identity, id: "test" }, [question], "testing", 0);
    session.submit("wrong");
    session.next();
    expect(store.getSnapshot().state.testHistory[0].summary.incorrect).toBe(1);
    expect(store.getSnapshot().state.difficultyRecords).toMatchObject([
      { courseId: "c", objectId: "object" },
    ]);
  });
});
