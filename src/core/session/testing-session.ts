import type { AnswerEvaluation, Question } from "../quiz/types.js";

export type PerQuestionTimerSeconds = 0 | 10 | 15 | 20;

export interface TestAnswerRecord {
  readonly questionId: string;
  readonly question: Question;
  readonly evaluation: AnswerEvaluation;
  readonly timedOut: boolean;
  readonly elapsedMs: number;
  readonly answeredAt: string;
  readonly submittedAnswers: readonly string[];
}

export interface TestSummary {
  readonly total: number;
  readonly answered: number;
  readonly fullyCorrect: number;
  readonly partiallyCorrect: number;
  readonly incorrect: number;
  readonly timedOut: number;
  readonly score: number;
  readonly percentage: number;
  readonly records: readonly TestAnswerRecord[];
}

export interface TestSubmission {
  readonly evaluation: AnswerEvaluation;
  readonly submittedAnswers?: readonly string[];
  readonly answeredAt?: string;
}

const TIMED_OUT_EVALUATION: AnswerEvaluation = {
  score: 0, fullyCorrect: false, matched: [], missed: [], extra: [],
};

export class TestingSession {
  private index = 0;
  private startedAt?: number;
  private records: TestAnswerRecord[] = [];

  constructor(private readonly questions: readonly Question[], readonly timerSeconds: PerQuestionTimerSeconds) {
    if (![0, 10, 15, 20].includes(timerSeconds)) throw new RangeError("Timer must be disabled or set to 10, 15, or 20 seconds.");
  }

  current(nowMs: number): Question | undefined {
    if (this.startedAt === undefined && this.questions[this.index]) this.startedAt = nowMs;
    return this.questions[this.index];
  }

  remainingMs(nowMs: number): number | undefined {
    if (this.timerSeconds === 0 || this.startedAt === undefined) return undefined;
    return Math.max(0, this.timerSeconds * 1000 - (nowMs - this.startedAt));
  }

  submit(
    questionId: string,
    evaluationOrSubmission: AnswerEvaluation | TestSubmission,
    nowMs: number,
  ): TestAnswerRecord {
    const question = this.questions[this.index];
    if (!question || question.id !== questionId || this.startedAt === undefined) throw new Error("Answer does not match the current test question.");
    const elapsedMs = Math.max(0, nowMs - this.startedAt);
    const timedOut = this.timerSeconds > 0 && elapsedMs >= this.timerSeconds * 1000;
    const submission = isSubmission(evaluationOrSubmission)
      ? evaluationOrSubmission
      : { evaluation: evaluationOrSubmission };
    const record: TestAnswerRecord = {
      questionId,
      question,
      evaluation: timedOut ? TIMED_OUT_EVALUATION : submission.evaluation,
      timedOut,
      elapsedMs,
      answeredAt: submission.answeredAt ?? new Date().toISOString(),
      submittedAnswers: [...(submission.submittedAnswers ?? [])],
    };
    this.records.push(record);
    this.index += 1;
    this.startedAt = undefined;
    return record;
  }

  expire(nowMs: number): TestAnswerRecord | undefined {
    const question = this.questions[this.index];
    if (!question || this.timerSeconds === 0 || this.startedAt === undefined || this.remainingMs(nowMs)! > 0) return undefined;
    return this.submit(question.id, TIMED_OUT_EVALUATION, nowMs);
  }

  isComplete(): boolean {
    return this.index >= this.questions.length;
  }

  summary(): TestSummary {
    const fullyCorrect = this.records.filter((record) => record.evaluation.fullyCorrect).length;
    return {
      total: this.questions.length,
      answered: this.records.length,
      fullyCorrect,
      partiallyCorrect: this.records.filter((record) => record.evaluation.score > 0 && !record.evaluation.fullyCorrect).length,
      incorrect: this.records.filter((record) => !record.evaluation.fullyCorrect).length,
      timedOut: this.records.filter((record) => record.timedOut).length,
      score: fullyCorrect,
      percentage: this.questions.length === 0 ? 0 : fullyCorrect / this.questions.length * 100,
      records: [...this.records],
    };
  }
}

function isSubmission(value: AnswerEvaluation | TestSubmission): value is TestSubmission {
  return "evaluation" in value;
}
