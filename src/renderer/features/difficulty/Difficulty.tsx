import { useState } from "react";
import type { Course } from "../../../core/course/types";
import { translate, type Locale } from "../../i18n/index";
import { type LocalState } from "../../../contracts/local-state.js";
import type { DifficultyRecord } from "../../../core/difficulty/difficulty-memory";
import { difficultyCardCopy } from "../../i18n/difficulty";

export function Difficulty({
  locale,
  course,
  records,
  onClear,
  onRemove,
  onPractice,
}: {
  locale: Locale;
  course?: Course;
  records: LocalState["difficultyRecords"];
  onClear(): void;
  onRemove(record: DifficultyRecord): void;
  onPractice(record: DifficultyRecord): void;
}) {
  const copy = difficultyCardCopy[locale];
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const names = new Map(
    course?.items.map((item) => [item.id, item.name]) ?? [],
  );
  const objects = [...records].sort((left, right) =>
    (names.get(left.objectId) ?? left.objectId).localeCompare(
      names.get(right.objectId) ?? right.objectId,
      locale,
    ),
  );
  return (
    <div className="page-list">
      <div className="list-heading">
        <p className="eyebrow">{translate(locale, "progress").toUpperCase()}</p>
        <div className="page-heading">
          <h1>{translate(locale, "difficultItems")}</h1>
          <button
            className="metal-button"
            disabled={records.length === 0}
            onClick={onClear}
          >
            {translate(locale, "clearAllDifficulty")}
          </button>
        </div>
      </div>
      <div className="history-list list-scroll">
        {objects.length === 0 && <p>{translate(locale, "emptyDifficulty")}</p>}
        {objects.map((entry) => {
          const key = `${entry.courseId}:${entry.objectId}`;
          const confirming = confirmingKey === key;
          return (
            <article className="setting-panel difficulty-object-card" key={key}>
              <div className="difficulty-object-head">
                <h2>{names.get(entry.objectId) ?? entry.objectId}</h2>
              </div>
              <ul className="difficulty-aspect-list">
                <li className="difficulty-aspect-row" key={key}>
                  <span className="difficulty-aspect-label">
                    {copy.recovery}
                  </span>
                  <span className="difficulty-aspect-progress">
                    {entry.consecutiveCorrect} / 2
                  </span>
                  <span className="difficulty-aspect-actions">
                    <button
                      className="gold-button"
                      type="button"
                      onClick={() => onPractice(entry)}
                    >
                      {copy.practice}
                    </button>
                    <button
                      className={`course-remove-button${confirming ? " confirm-delete" : ""}`}
                      type="button"
                      aria-label={`${translate(locale, "removeCourse")} ${names.get(entry.objectId) ?? entry.objectId}`}
                      onClick={() => {
                        if (confirming) {
                          setConfirmingKey(null);
                          onRemove(entry);
                        } else {
                          setConfirmingKey(key);
                        }
                      }}
                    >
                      {confirming ? copy.confirmDelete : "×"}
                    </button>
                  </span>
                </li>
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
