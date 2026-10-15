import { translate, type Locale } from "../../i18n/index";
import {
  type LearningHistoryRecord,
  type TestHistoryRecord,
} from "../../../core/session/index";
import { historyCopy } from "../../i18n/history";

export function LearningHistory({
  locale,
  records,
  onOpen,
}: {
  locale: Locale;
  records: LearningHistoryRecord[];
  onOpen(record: LearningHistoryRecord): void;
}) {
  const copy = historyCopy[locale];
  return (
    <div className="page-list">
      <div className="list-heading">
        <p className="eyebrow">{translate(locale, "progress").toUpperCase()}</p>
        <h1>{copy.learningHistory}</h1>
      </div>
      <div className="history-list list-scroll">
        {records.length === 0 && <p>{copy.noLearningHistory}</p>}
        {[...records].reverse().map((record) => (
          <article
            className="setting-panel history-card"
            key={record.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(record)}
            onKeyDown={(event) =>
              (event.key === "Enter" || event.key === " ") && onOpen(record)
            }
          >
            <h2>{new Date(record.completedAt).toLocaleString(locale)}</h2>
            <span>
              {translate(locale, "questions")} {record.questionCount} /{" "}
              {copy.attempts} {record.attemptCount}
            </span>
            <span className="history-card-open">{copy.answerComparison} →</span>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TestHistory({
  locale,
  records,
  onOpen,
}: {
  locale: Locale;
  records: TestHistoryRecord[];
  onOpen(record: TestHistoryRecord): void;
}) {
  const copy = historyCopy[locale];
  return (
    <div className="page-list">
      <div className="list-heading">
        <p className="eyebrow">{translate(locale, "progress").toUpperCase()}</p>
        <h1>{copy.testHistory}</h1>
      </div>
      <div className="history-list list-scroll">
        {records.length === 0 && <p>{copy.noTestHistory}</p>}
        {[...records].reverse().map((record) => (
          <article
            className="setting-panel history-card"
            key={record.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(record)}
            onKeyDown={(event) =>
              (event.key === "Enter" || event.key === " ") && onOpen(record)
            }
          >
            <h2>{new Date(record.completedAt).toLocaleString(locale)}</h2>
            <strong>{Math.round(record.summary.percentage)}%</strong>
            <span>
              {" "}
              {translate(locale, "questions")} {record.summary.total} /{" "}
              {translate(locale, "timer")}:{" "}
              {record.timerSeconds === 0
                ? translate(locale, "off")
                : `${record.timerSeconds}s`}
            </span>
            <span>
              {" "}
              {translate(locale, "correctCount")} {record.summary.fullyCorrect}{" "}
              / {translate(locale, "incorrectCount")} {record.summary.incorrect}
            </span>
            <span className="history-card-open">{copy.answerComparison} →</span>
          </article>
        ))}
      </div>
    </div>
  );
}
