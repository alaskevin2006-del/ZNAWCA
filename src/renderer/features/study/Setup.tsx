import { useEffect, useState } from "react";
import type { Course } from "../../../core/course/types";
import { translate, type Locale, type MessageKey } from "../../i18n/index";
import { type LocalState } from "../../../contracts/local-state.js";
import {
  filterOptions,
  filteredCourseObjects,
} from "../../../core/quiz/course-adapter";
import { type CourseQuestionSet } from "../../../core/quiz/question-set";
import { progressSummary } from "../../../core/progress/knowledge-progress";
import type {
  FilterSelection,
  QuestionDirection,
} from "../../../core/quiz/types";
import {
  CoverageMode,
  EnabledDirections,
  EnabledKinds,
  Mode,
  Timer,
} from "./types";
import { directionLabels, setupCopy } from "../../i18n/study";

export interface SetupProps {
  locale: Locale;
  course: string;
  courseData: Course;
  filters: FilterSelection[];
  setFilters(value: FilterSelection[]): void;
  kinds: EnabledKinds;
  setKinds(value: EnabledKinds): void;
  directions: EnabledDirections;
  setDirections(value: EnabledDirections): void;
  coverageMode: CoverageMode;
  setCoverageMode(value: CoverageMode): void;
  questionLimit: number;
  setQuestionLimit(value: number): void;
  mode: Mode;
  setMode(value: Mode): void;
  timer: Timer;
  setTimer(value: Timer): void;
  strict: boolean;
  setStrict(value: boolean): void;
  questionSet: CourseQuestionSet;
  capabilitySet: CourseQuestionSet;
  progress: LocalState["knowledgeProgress"];
  onStart(): void;
}

export function Setup(props: SetupProps) {
  const [unavailableNotice, setUnavailableNotice] = useState<{
    id: number;
    message: string;
  }>();
  const [openSection, setOpenSection] = useState<
    "types" | "scope" | "strategy" | "timer"
  >();
  useEffect(() => {
    if (!unavailableNotice) return;
    const timeout = window.setTimeout(
      () => setUnavailableNotice(undefined),
      2500,
    );
    return () => window.clearTimeout(timeout);
  }, [unavailableNotice]);
  const options = filterOptions(props.courseData);
  const objects = filteredCourseObjects(props.courseData, props.filters).length;
  const summary = progressSummary(
    props.questionSet.questions,
    props.courseData.id,
    props.progress,
  );
  const available = summary.eligibleProjects;
  const selectedQuestionCount =
    available === 0
      ? 0
      : props.coverageMode === "all"
        ? available
        : questionLimitFor(available, props.questionLimit);
  const selectedFilterCount = props.filters.filter(
    (entry) => entry.values.length > 0,
  ).length;
  const directionCount = (direction: QuestionDirection) =>
    props.capabilitySet.availability.byDirection[direction] ?? 0;
  const selectedTypeCount =
    Number(props.kinds.input) +
    Number(props.kinds.choice) +
    directionLabels.filter(
      ([direction]) =>
        props.directions[direction] && directionCount(direction) > 0,
    ).length;
  const toggleFilter = (field: string, value: string) => {
    const current =
      props.filters.find((entry) => entry.field === field)?.values ?? [];
    const values = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    props.setFilters([
      ...props.filters.filter((entry) => entry.field !== field),
      { field, values },
    ]);
  };
  const explainUnavailable = (label: MessageKey) => {
    setUnavailableNotice({
      id: Date.now(),
      message: `${translate(props.locale, label)}: ${translate(props.locale, "unavailableReason")}`,
    });
  };
  const toggleSection = (section: "types" | "scope" | "strategy" | "timer") =>
    setOpenSection((current) => (current === section ? undefined : section));
  const copy = setupCopy[props.locale];
  return (
    <div className="page setup-page">
      <header className="setup-heading">
        <div>
          <p className="eyebrow">
            {props.course.toUpperCase()} /{" "}
            {translate(props.locale, "sessionSetup").toUpperCase()}
          </p>
          <h1>{translate(props.locale, "shapeSession")}</h1>
        </div>
        <div className="setup-primary">
          <div
            className="segmented compact-segmented"
            aria-label={translate(props.locale, "mode")}
          >
            <button
              className={props.mode === "learning" ? "active" : ""}
              onClick={() => props.setMode("learning")}
            >
              {translate(props.locale, "learning")}
            </button>
            <button
              className={props.mode === "testing" ? "active" : ""}
              onClick={() => props.setMode("testing")}
            >
              {translate(props.locale, "testing")}
            </button>
          </div>
          <div
            className="coverage-control"
            aria-label={translate(props.locale, "questions")}
          >
            <button
              className={props.coverageMode === "sample" ? "active" : ""}
              type="button"
              aria-label={copy.sample}
              onClick={() => props.setCoverageMode("sample")}
            >
              {copy.sample}
              <small>{props.questionLimit}</small>
            </button>
            <button
              className={props.coverageMode === "all" ? "active" : ""}
              type="button"
              aria-label={copy.fullCoverage}
              onClick={() => props.setCoverageMode("all")}
            >
              {copy.fullCoverage}
              <small>{available}</small>
            </button>
            {props.coverageMode === "sample" && available > 0 && (
              <label className="compact-field">
                <input
                  aria-label={translate(props.locale, "questions")}
                  type="number"
                  min={available < 3 ? 1 : 3}
                  max={Math.max(1, available)}
                  value={Math.min(
                    selectedQuestionCount,
                    Math.max(1, available),
                  )}
                  onChange={(event) =>
                    props.setQuestionLimit(
                      questionLimitFor(
                        available,
                        Number(event.target.value) || 1,
                      ),
                    )
                  }
                />
                <small>/ {available}</small>
              </label>
            )}
          </div>
        </div>
      </header>
      <div className="setup-disclosures">
        <section
          className={`setup-disclosure${openSection === "types" ? " is-open" : ""}`}
        >
          <button
            className="setup-disclosure-toggle"
            type="button"
            aria-expanded={openSection === "types"}
            onClick={() => toggleSection("types")}
          >
            <span>
              <strong>{translate(props.locale, "questionTypes")}</strong>
              <small>
                {selectedTypeCount} · {props.questionSet.availability.input}{" "}
                {translate(props.locale, "inputAvailable")} ·{" "}
                {props.questionSet.availability.choice}{" "}
                {translate(props.locale, "choiceAvailable")}
              </small>
            </span>
            <b aria-hidden="true">{openSection === "types" ? "−" : "+"}</b>
          </button>
          {openSection === "types" && (
            <div className="setup-disclosure-body">
              <div className="check-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={props.kinds.input}
                    onChange={() =>
                      props.setKinds({
                        ...props.kinds,
                        input: !props.kinds.input,
                      })
                    }
                  />{" "}
                  {translate(props.locale, "textInput")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={props.kinds.choice}
                    onChange={() =>
                      props.setKinds({
                        ...props.kinds,
                        choice: !props.kinds.choice,
                      })
                    }
                  />{" "}
                  {translate(props.locale, "multipleChoice")}
                </label>
                {directionLabels.map(([key, label]) => {
                  const count = directionCount(key);
                  if (count === 0)
                    return (
                      <div
                        key={key}
                        className="unavailable-option"
                        role="button"
                        tabIndex={0}
                        title={translate(props.locale, "unavailableReason")}
                        onClick={() => explainUnavailable(label)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            explainUnavailable(label);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled
                          aria-label={translate(props.locale, label)}
                        />
                        <span>
                          {translate(props.locale, label)}{" "}
                          <small aria-hidden="true">{count}</small>
                        </span>
                      </div>
                    );
                  return (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={props.directions[key]}
                        onChange={() =>
                          props.setDirections({
                            ...props.directions,
                            [key]: !props.directions[key],
                          })
                        }
                      />{" "}
                      {translate(props.locale, label)}{" "}
                      <small aria-hidden="true">{count}</small>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        <section
          className={`setup-disclosure${openSection === "scope" ? " is-open" : ""}`}
        >
          <button
            className="setup-disclosure-toggle"
            type="button"
            aria-expanded={openSection === "scope"}
            onClick={() => toggleSection("scope")}
          >
            <span>
              <strong>{translate(props.locale, "scopeFilters")}</strong>
              <small>
                {objects} {translate(props.locale, "objects")} ·{" "}
                {selectedFilterCount}
              </small>
            </span>
            <b aria-hidden="true">{openSection === "scope" ? "−" : "+"}</b>
          </button>
          {openSection === "scope" && (
            <div className="setup-disclosure-body filter-disclosure">
              {Object.entries(options).map(([field, values]) => (
                <fieldset className="filter-group" key={field}>
                  <legend>
                    {field.startsWith("#") ? field.slice(1).trim() : field}
                  </legend>
                  {values.map((value) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={
                          props.filters
                            .find((entry) => entry.field === field)
                            ?.values.includes(value) ?? false
                        }
                        onChange={() => toggleFilter(field, value)}
                      />{" "}
                      {value}
                    </label>
                  ))}
                </fieldset>
              ))}
              {Object.keys(options).length === 0 && (
                <p className="filter-empty">
                  {translate(props.locale, "noFilters")}
                </p>
              )}
            </div>
          )}
        </section>
        <section
          className={`setup-disclosure${openSection === "strategy" ? " is-open" : ""}`}
        >
          <button
            className="setup-disclosure-toggle"
            type="button"
            aria-expanded={openSection === "strategy"}
            onClick={() => toggleSection("strategy")}
          >
            <span>
              <strong>{translate(props.locale, "teachingStyle")}</strong>
              <small>
                {translate(props.locale, props.strict ? "strict" : "lenient")}
              </small>
            </span>
            <b aria-hidden="true">{openSection === "strategy" ? "−" : "+"}</b>
          </button>
          {openSection === "strategy" && (
            <div className="setup-disclosure-body strategy-disclosure">
              <div className="segmented">
                <button
                  className={props.strict ? "active" : ""}
                  onClick={() => props.setStrict(true)}
                >
                  {translate(props.locale, "strict")}
                  <small>{translate(props.locale, "strictHelp")}</small>
                </button>
                <button
                  className={!props.strict ? "active" : ""}
                  onClick={() => props.setStrict(false)}
                >
                  {translate(props.locale, "lenient")}
                  <small>{translate(props.locale, "lenientHelp")}</small>
                </button>
              </div>
            </div>
          )}
        </section>
        {props.mode === "testing" && (
          <section
            className={`setup-disclosure${openSection === "timer" ? " is-open" : ""}`}
          >
            <button
              className="setup-disclosure-toggle"
              type="button"
              aria-expanded={openSection === "timer"}
              onClick={() => toggleSection("timer")}
            >
              <span>
                <strong>{copy.perQuestionTimer}</strong>
                <small>
                  {props.timer === 0
                    ? translate(props.locale, "off")
                    : `${props.timer}s`}
                </small>
              </span>
              <b aria-hidden="true">{openSection === "timer" ? "−" : "+"}</b>
            </button>
            {openSection === "timer" && (
              <div className="setup-disclosure-body timer-disclosure">
                <div className="timer-row">
                  {([0, 10, 15, 20] as const).map((value) => (
                    <button
                      key={value}
                      className={props.timer === value ? "active" : ""}
                      onClick={() => props.setTimer(value)}
                    >
                      {value === 0
                        ? translate(props.locale, "off")
                        : `${value}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      {unavailableNotice && (
        <div
          className="temporary-notice"
          role="status"
          aria-live="polite"
          key={unavailableNotice.id}
        >
          {unavailableNotice.message}
        </div>
      )}
      <footer className="setup-footer">
        <span>
          <strong>{selectedQuestionCount}</strong> / {available} {copy.projects}{" "}
          · {summary.coveredProjects}/{summary.eligibleProjects} {copy.learned}{" "}
          · {summary.masteredProjects} {copy.mastered} ·{" "}
          {summary.unseenProjects} {copy.unseen}
        </span>
        <button
          className="gold-button large"
          disabled={
            available === 0 || (!props.kinds.input && !props.kinds.choice)
          }
          onClick={props.onStart}
        >
          {translate(props.locale, "begin")}{" "}
          {translate(props.locale, props.mode)}
        </button>
      </footer>
    </div>
  );
}

export function questionLimitFor(available: number, requested: number): number {
  if (available <= 0) return 1;
  const minimum = available < 3 ? 1 : 3;
  return Math.min(available, Math.max(minimum, requested));
}

// D-11/D-25：选择题为纯图片/音频/视频选项且为 3 或 4 项时启用媒体 2×2 网格标记。
// 文字选择题不适用；判定只依赖选项媒体类型与数量，
// 不改变答案数据顺序。
