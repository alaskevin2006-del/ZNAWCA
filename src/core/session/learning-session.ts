import type { AnswerEvaluation, Question } from "../quiz/types.js";

export interface LearningQuestionProgress {
  readonly question: Question;
  readonly requiredStreak: 1 | 2;
  readonly correctStreak: number;
  readonly attempts: number;
}

export interface LearningAnswerRecord {
  readonly questionId: string;
  readonly question: Question;
  readonly evaluation: AnswerEvaluation;
  readonly answeredAt: string;
  readonly submittedAnswers: readonly string[];
}

export interface LearningSnapshot {
  readonly queue: readonly LearningQuestionProgress[];
  readonly completedQuestionIds: readonly string[];
  readonly records?: readonly LearningAnswerRecord[];
}

export class LearningSession {
  private queue: LearningQuestionProgress[];
  private completed = new Set<string>();
  private records: LearningAnswerRecord[] = [];

  constructor(questionsOrSnapshot: readonly Question[] | LearningSnapshot) {
    if (!isSnapshot(questionsOrSnapshot)) {
      this.queue = questionsOrSnapshot.map((question) => ({ question, requiredStreak: 1, correctStreak: 0, attempts: 0 }));
    } else {
      this.queue = questionsOrSnapshot.queue.map((progress) => ({ ...progress }));
      this.completed = new Set(questionsOrSnapshot.completedQuestionIds);
      this.records = [...(questionsOrSnapshot.records ?? [])];
    }
  }

  current(): Question | undefined {
    return this.queue[0]?.question;
  }

  answer(
    questionId: string,
    evaluation: AnswerEvaluation,
    answeredAt = new Date().toISOString(),
    submittedAnswers: readonly string[] = [],
  ): LearningQuestionProgress {
    const progress = this.queue.shift();
    if (!progress || progress.question.id !== questionId) throw new Error("Answer does not match the current learning question.");
    const attempts = progress.attempts + 1;
    this.records.push({
      questionId,
      question: progress.question,
      evaluation,
      answeredAt,
      submittedAnswers: [...submittedAnswers],
    });
    if (!evaluation.fullyCorrect) {
      const question = reshuffleChoiceOptions(progress.question);
      const updated = { ...progress, question, requiredStreak: 2 as const, correctStreak: 0, attempts };
      this.queue.push(updated);
      return updated;
    }
    const streak = progress.correctStreak + 1;
    if (streak >= progress.requiredStreak) this.completed.add(questionId);
    else this.queue.push({ ...progress, correctStreak: streak, attempts });
    return { ...progress, correctStreak: streak, attempts };
  }

  isComplete(): boolean {
    return this.queue.length === 0;
  }

  snapshot(): LearningSnapshot {
    return {
      queue: this.queue.map((progress) => ({ ...progress })),
      completedQuestionIds: [...this.completed],
      records: [...this.records],
    };
  }
}

function isSnapshot(value: readonly Question[] | LearningSnapshot): value is LearningSnapshot {
  return "queue" in value;
}

/**
 * 答错重入队时，对选择题的选项重新随机打乱，避免重复出现时顺序固定。
 * 只浅拷贝 question（options 为新数组），不修改历史记录里保存的原对象。
 */
function reshuffleChoiceOptions(question: Question): Question {
  if (question.kind !== "choice" || !question.options?.length) return question;
  const options = [...question.options];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [options[index], options[swap]] = [options[swap]!, options[index]!];
  }
  return { ...question, options };
}
