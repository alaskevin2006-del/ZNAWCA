import { translate, type Locale } from "../i18n/index";
import { Screen } from "./types";
import { historyCopy } from "../i18n/history";

export function Header({
  locale,
  onHome,
  onSettings,
}: {
  locale: Locale;
  onHome(): void;
  onSettings(): void;
}) {
  return (
    <header className="title-bar">
      <button className="brand" type="button" onClick={onHome}>
        <span className="brand-mark">Z</span>
        <span>Znawca</span>
      </button>
      <div className="title-actions">
        <button
          className="icon-button"
          type="button"
          aria-label={translate(locale, "settings")}
          title={translate(locale, "interfaceLanguage")}
          onClick={onSettings}
        >
          ⚑
        </button>
      </div>
    </header>
  );
}

export function CourseContextNav({
  locale,
  course,
  screen,
  learningHistoryCount,
  testHistoryCount,
  difficultyCount,
  onCourses,
  onSetup,
  onLearningHistory,
  onTestHistory,
  onDifficulty,
}: {
  locale: Locale;
  course: string;
  screen: Screen;
  learningHistoryCount: number;
  testHistoryCount: number;
  difficultyCount: number;
  onCourses(): void;
  onSetup(): void;
  onLearningHistory(): void;
  onTestHistory(): void;
  onDifficulty(): void;
}) {
  const copy = historyCopy[locale];
  return (
    <nav className="course-context-nav" aria-label={course}>
      <button className="course-context-back" type="button" onClick={onCourses}>
        ← {translate(locale, "courses")}
      </button>
      <strong dir="auto">{course}</strong>
      <div>
        <button
          type="button"
          aria-current={screen === "setup" ? "page" : undefined}
          onClick={onSetup}
        >
          {translate(locale, "learning")} / {translate(locale, "testing")}
        </button>
        <button
          type="button"
          aria-current={screen === "learning-history" ? "page" : undefined}
          onClick={onLearningHistory}
        >
          {copy.learningHistory} <small>{learningHistoryCount}</small>
        </button>
        <button
          type="button"
          aria-current={screen === "test-history" ? "page" : undefined}
          onClick={onTestHistory}
        >
          {copy.testHistory} <small>{testHistoryCount}</small>
        </button>
        <button
          type="button"
          aria-current={screen === "difficulty" ? "page" : undefined}
          onClick={onDifficulty}
        >
          {translate(locale, "difficultItems")} <small>{difficultyCount}</small>
        </button>
      </div>
    </nav>
  );
}
