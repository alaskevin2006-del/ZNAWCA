import { translate, type Locale } from "../../i18n/index";
import type { AnswerEvaluation, Question } from "../../../core/quiz/types";
import { historyCopy } from "../../i18n/history";
import { directionLabels } from "../../i18n/study";
import { QuestionMedia } from "../../shared/media/QuestionMedia";
import {
  AnswerValues,
  FeedbackDetails,
  answerMediaKind,
} from "../../shared/question/answers";
import {
  isMediaGridOptions,
  promptText,
} from "../../shared/question/presentation";

export function ReplayView({
  locale,
  course,
  kind,
  answers,
  index,
  volume,
  onVolume,
  onIndex,
  onExit,
}: {
  locale: Locale;
  course: string;
  kind: "learning" | "test";
  answers: ReadonlyArray<{
    questionId: string;
    question?: Question;
    submittedAnswers: readonly string[];
    evaluation: AnswerEvaluation;
  }>;
  index: number;
  volume: number;
  onVolume(value: number): void;
  onIndex(value: number): void;
  onExit(): void;
}) {
  const copy = historyCopy[locale];
  const record = answers[index];
  const question = record?.question;
  if (!question) {
    return (
      <div className="page-list">
        <div className="list-heading">
          <p className="eyebrow">{course}</p>
          <h1>{copy.replayTitle}</h1>
        </div>
        <div className="history-list list-scroll">
          <p>{copy.noAnswerRecord}</p>
          <button className="metal-button" type="button" onClick={onExit}>
            {copy.backToList}
          </button>
        </div>
      </div>
    );
  }
  const directionLabel = directionLabels.find(
    ([direction]) => direction === question.direction,
  )?.[1];
  const isTest = kind === "test";
  const evaluation = record.evaluation;
  const fullyCorrect = evaluation.fullyCorrect;
  const partial = !fullyCorrect && evaluation.score > 0;
  const correctValues = new Set(question.acceptedAnswers);
  return (
    <div className="replay-view">
      <header className="replay-header">
        <div className="replay-meta">
          <p>
            {course} / {isTest ? copy.testHistory : copy.learningHistory}
          </p>
          <strong>
            {translate(locale, "question")} {index + 1}{" "}
            {translate(locale, "of")} {answers.length}
          </strong>
        </div>
        <div className="replay-nav">
          <button
            type="button"
            className="replay-step"
            onClick={() => onIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label={translate(locale, "back")}
          >
            ←
          </button>
          <select
            value={index}
            onChange={(event) => onIndex(Number(event.target.value))}
            aria-label={translate(locale, "question")}
          >
            {answers.map((_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="replay-step"
            onClick={() => onIndex(Math.min(answers.length - 1, index + 1))}
            disabled={index === answers.length - 1}
            aria-label={translate(locale, "next")}
          >
            →
          </button>
        </div>
        <button
          type="button"
          className="metal-button replay-exit"
          onClick={onExit}
        >
          {copy.backToList}
        </button>
      </header>
      <article
        className={`question-card replay-card${isMediaGridOptions(question) ? " media-grid-card" : ""}`}
      >
        <p className="section-label">
          {directionLabel
            ? translate(locale, directionLabel).toUpperCase()
            : question.direction.toUpperCase()}
        </p>
        <h1 dir="auto">{promptText(locale, question)}</h1>
        {question.media && (
          <QuestionMedia
            locale={locale}
            media={question.media}
            volume={volume}
            onVolume={onVolume}
          />
        )}
        {question.kind === "choice" ? (
          <fieldset
            className={`choice-list${isMediaGridOptions(question) ? " media-grid" : ""}`}
            disabled
          >
            <legend>{translate(locale, "yourAnswer")}</legend>
            {question.options?.map((option) => {
              const selected = record.submittedAnswers.includes(option.value);
              const isCorrect = correctValues.has(option.value);
              return (
                <label
                  key={option.id}
                  className={`${selected ? "is-selected" : ""}${isTest && isCorrect ? " is-correct" : ""}${isTest && selected && !isCorrect ? " is-wrong" : ""}`}
                >
                  <input
                    type="radio"
                    name="replay-answer"
                    checked={selected}
                    readOnly
                  />
                  {option.media ? (
                    <QuestionMedia
                      locale={locale}
                      media={option.media}
                      volume={volume}
                      onVolume={onVolume}
                    />
                  ) : (
                    <span dir="auto">{option.label}</span>
                  )}
                  {isTest && isCorrect && (
                    <em className="answer-mark">
                      {translate(locale, "correct")}
                    </em>
                  )}
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="answer-box replay-input">
            <span>{translate(locale, "yourAnswer")}</span>
            <div className="replay-user-answer" dir="auto">
              {record.submittedAnswers.join("; ") ||
                translate(locale, "noAnswer")}
            </div>
          </div>
        )}
        <div
          className={`feedback replay-feedback${isTest ? (fullyCorrect ? " correct" : " incorrect") : ""}`}
        >
          <strong>
            {isTest
              ? fullyCorrect
                ? translate(locale, "correct")
                : partial
                  ? translate(locale, "partialCount")
                  : translate(locale, "notQuite")
              : copy.answerComparison}
          </strong>
          <div className="replay-answers">
            <span dir="auto">
              {translate(locale, "submittedAnswer")}:{" "}
              {record.submittedAnswers.length > 0 ? (
                <AnswerValues
                  locale={locale}
                  values={record.submittedAnswers}
                  mediaKind={answerMediaKind(question.direction)}
                  volume={volume}
                  onVolume={onVolume}
                  options={question.options}
                  plain
                />
              ) : (
                translate(locale, "noAnswer")
              )}
            </span>
            <span dir="auto">
              {translate(locale, "correctAnswer")}:{" "}
              <AnswerValues
                locale={locale}
                values={question.acceptedAnswers}
                mediaKind={answerMediaKind(question.direction)}
                volume={volume}
                onVolume={onVolume}
                options={question.options}
                plain
              />
            </span>
          </div>
          <FeedbackDetails
            locale={locale}
            evaluation={evaluation}
            question={question}
            volume={volume}
            onVolume={onVolume}
          />
        </div>
      </article>
    </div>
  );
}
