import { translate, type Locale } from "../../i18n/index";
import { type TestHistoryRecord } from "../../../core/session/index";
import { AnswerValues, answerMediaKind } from "../../shared/question/answers";
import { promptText } from "../../shared/question/presentation";

export function Results({
  locale,
  learningTotal,
  history,
  reviewOpen,
  setReviewOpen,
  onAgain,
  onCourses,
  volume,
  onVolume,
}: {
  locale: Locale;
  learningTotal: number;
  history?: TestHistoryRecord;
  reviewOpen: boolean;
  setReviewOpen(value: boolean): void;
  onAgain(): void;
  onCourses(): void;
  volume: number;
  onVolume(value: number): void;
}) {
  const summary = history?.summary;
  const percentage = Math.round(summary?.percentage ?? 100);
  return (
    <div className="results-page">
      <p className="eyebrow">
        {translate(locale, "sessionComplete").toUpperCase()}
      </p>
      <div className="score-medallion">
        <strong>{percentage}%</strong>
        <span>
          {summary
            ? `${summary.score} / ${summary.total} ${translate(locale, "points")}`
            : `${learningTotal} ${translate(locale, "masteredCount")}`}
        </span>
      </div>
      {summary && (
        <div className="result-stats">
          <span>
            {translate(locale, "correctCount")} {summary.fullyCorrect}
          </span>
          <span>
            {translate(locale, "incorrectCount")} {summary.incorrect}
          </span>
        </div>
      )}
      <h1>
        {percentage === 100
          ? translate(locale, "flawless")
          : translate(locale, "progressWorth")}
      </h1>
      {summary && (
        <button
          className="metal-button"
          onClick={() => setReviewOpen(!reviewOpen)}
        >
          {translate(locale, "reviewAnswers")}
        </button>
      )}
      {reviewOpen && summary && (
        <div className="answer-review">
          {summary.records.map((record) => (
            <article key={record.questionId}>
              <strong>{promptText(locale, record.question)}</strong>
              <span>
                {translate(locale, "submittedAnswer")}:{" "}
                {record.submittedAnswers.length > 0 ? (
                  <AnswerValues
                    locale={locale}
                    values={record.submittedAnswers}
                    mediaKind={answerMediaKind(record.question.direction)}
                    volume={volume}
                    onVolume={onVolume}
                    options={record.question.options}
                    plain
                  />
                ) : (
                  translate(locale, "noAnswer")
                )}
              </span>
              <span>
                {translate(locale, "correctAnswer")}:{" "}
                <AnswerValues
                  locale={locale}
                  values={record.question.acceptedAnswers}
                  mediaKind={answerMediaKind(record.question.direction)}
                  volume={volume}
                  onVolume={onVolume}
                  options={record.question.options}
                  plain
                />
              </span>
            </article>
          ))}
        </div>
      )}
      <div className="result-actions">
        <button className="metal-button" onClick={onCourses}>
          {translate(locale, "courses")}
        </button>
        <button className="gold-button" onClick={onAgain}>
          {history
            ? translate(locale, "testing")
            : translate(locale, "learning")}
        </button>
      </div>
    </div>
  );
}
