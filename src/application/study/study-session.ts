import type { AnswerEvaluation, Question } from "../../core/quiz/types.js";
import { evaluateAnswer } from "../../core/quiz/scoring.js";
import type { ProgressUnitCounts } from "../../core/progress/knowledge-progress.js";
import {
  LearningSessionController,
  TestingSessionController,
  type SessionIdentity,
  type LearningSessionRecord,
  type TestHistoryRecord,
} from "../../core/session/session-controller.js";
import type { LocalStateStore } from "../state/local-state-store.js";
import { rememberMedia, saveLearningSession } from "../state/updates.js";
import { completeLearning, completeTest } from "./completion.js";

export interface StudySnapshot {
  readonly phase: "idle" | "session" | "results";
  readonly mode: "learning" | "testing";
  readonly question?: Question;
  readonly feedback?: AnswerEvaluation;
  readonly needsAnother: boolean;
  readonly position: number;
  readonly total: number;
  readonly units?: ProgressUnitCounts;
  readonly result?: TestHistoryRecord;
}

/** Owns the controller and its display snapshot, including the submitted question until Next. */
export class StudySession {
  private learning?: LearningSessionController;
  private testing?: TestingSessionController;
  private snapshot: StudySnapshot = {
    phase: "idle",
    mode: "learning",
    needsAnother: false,
    position: 1,
    total: 0,
  };
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly state: LocalStateStore,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  getSnapshot = (): StudySnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(
    identity: SessionIdentity,
    questions: readonly Question[],
    mode: "learning" | "testing",
    timer: 0 | 10 | 15 | 20,
  ): void {
    if (!questions.length) return;
    this.learning =
      mode === "learning"
        ? new LearningSessionController(identity, questions)
        : undefined;
    this.testing =
      mode === "testing"
        ? new TestingSessionController(identity, questions, timer)
        : undefined;
    const paths = questions.flatMap((entry) =>
      [
        entry.media?.path,
        ...(entry.options?.map((option) => option.media?.path) ?? []),
      ].filter((path): path is string => Boolean(path)),
    );
    if (paths.length)
      this.state.update((state) =>
        rememberMedia(state, identity.courseId, paths),
      );
    this.publish({
      phase: "session",
      mode,
      question: this.current(),
      needsAnother: false,
      position: 1,
      total: questions.length,
      units: this.units(),
    });
  }

  submit(answer: string): void {
    const { question, feedback, phase } = this.snapshot;
    if (!question || feedback || phase !== "session") return;
    const evaluation = evaluateAnswer(question.acceptedAnswers, answer);
    const submittedAnswers = answer ? [answer] : [];
    if (this.learning)
      this.learning.answer(
        question.id,
        evaluation,
        new Date(this.clock()).toISOString(),
        submittedAnswers,
      );
    else
      this.testing!.submit(
        question.id,
        { evaluation, submittedAnswers },
        this.clock(),
      );
    this.publish({
      ...this.snapshot,
      feedback: evaluation,
      units: this.units(),
      needsAnother:
        this.learning
          ?.save()
          .progress.queue.some((entry) => entry.question.id === question.id) ??
        false,
    });
  }

  timeout(): void {
    if (
      !this.testing ||
      this.snapshot.feedback ||
      this.snapshot.phase !== "session"
    )
      return;
    const record = this.testing.expire(this.clock());
    if (record)
      this.publish({
        ...this.snapshot,
        feedback: record.evaluation,
        units: this.units(),
      });
  }

  next(): void {
    if (this.snapshot.phase !== "session" || !this.snapshot.feedback) return;
    if (this.learning?.isComplete()) {
      const history = this.learning.history(
        new Date(this.clock()).toISOString(),
      );
      this.state.update((state) => completeLearning(state, history));
      this.publish({ ...this.snapshot, phase: "results", result: undefined });
    } else if (this.testing?.isComplete()) {
      const history = this.testing.history(
        new Date(this.clock()).toISOString(),
      );
      this.state.update((state) => completeTest(state, history));
      this.publish({ ...this.snapshot, phase: "results", result: history });
    } else {
      this.publish({
        ...this.snapshot,
        question: this.current(),
        position: this.snapshot.position + 1,
        feedback: undefined,
        needsAnother: false,
      });
    }
  }

  save(): void {
    if (this.learning && this.snapshot.phase === "session") {
      const record = this.learning.save(new Date(this.clock()).toISOString());
      this.state.update((state) => saveLearningSession(state, record));
    }
  }

  resume(record: LearningSessionRecord): void {
    this.learning = LearningSessionController.resume(record);
    this.testing = undefined;
    this.publish({
      phase: "session",
      mode: "learning",
      question: this.learning.current(),
      needsAnother: false,
      position: record.progress.completedQuestionIds.length + 1,
      total:
        record.progress.queue.length +
        record.progress.completedQuestionIds.length,
      units: this.learning.progressUnits(),
    });
  }

  private current(): Question | undefined {
    return this.learning
      ? this.learning.current()
      : this.testing?.current(this.clock());
  }
  private units(): ProgressUnitCounts | undefined {
    return (this.learning ?? this.testing)?.progressUnits();
  }
  private publish(snapshot: StudySnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
