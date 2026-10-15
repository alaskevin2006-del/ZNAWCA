import { useState } from "react";
import type { CourseIssue } from "../../../core/course/types";
import { formatItemNameEmpty, translate, type Locale } from "../../i18n/index";
import { type LearningSessionRecord } from "../../../core/session/index";
import {
  CourseListEntry,
  isLoadedCourse,
  issueKey,
} from "../../../application/courses/catalog";

export interface CoursesProps {
  locale: Locale;
  courses: CourseListEntry[];
  issues: readonly CourseIssue[];
  dismissedIssueKeys: readonly string[];
  onDismissIssue(issue: CourseIssue): void;
  onRestoreDismissed(): void;
  importNotice?: string;
  resumable: LearningSessionRecord[];
  canRefresh: boolean;
  onResume(record: LearningSessionRecord): void;
  onAdd(): Promise<void>;
  onRefresh(): Promise<void>;
  onSelect(course: CourseListEntry): void;
  onRemove(course: CourseListEntry): void;
}

export function Courses({
  locale,
  courses,
  issues,
  dismissedIssueKeys,
  onDismissIssue,
  onRestoreDismissed,
  importNotice,
  resumable,
  canRefresh,
  onResume,
  onAdd,
  onRefresh,
  onSelect,
  onRemove,
}: CoursesProps) {
  const [warningsOpen, setWarningsOpen] = useState(false);
  // error 阻断打开：全量展示且不可忽略；warning 不影响使用：默认折叠为一条横幅，
  // 展开后才逐条列出，每条可「忽略」并持久化消退，避免打开课程时倾倒整屏报错。
  const errorIssues = issues.filter((entry) => entry.severity === "error");
  const warningIssues = issues.filter((entry) => entry.severity === "warning");
  const dismissedSet = new Set(dismissedIssueKeys);
  const visibleWarnings = warningIssues.filter(
    (entry) => !dismissedSet.has(issueKey(entry)),
  );
  const dismissedCount = warningIssues.length - visibleWarnings.length;
  return (
    <div className="page-courses">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {translate(locale, "courses").toUpperCase()}
          </p>
          <h1>{translate(locale, "chooseMaster")}</h1>
          <p>{translate(locale, "privacyDetail")}</p>
        </div>
        <div className="page-heading-actions">
          {canRefresh && (
            <button
              className="metal-button"
              type="button"
              onClick={() => void onRefresh()}
            >
              {translate(locale, "refreshLibrary")}
            </button>
          )}
          <button
            className="gold-button"
            type="button"
            onClick={() => void onAdd()}
          >
            {translate(locale, "addCourse")}
          </button>
        </div>
      </div>
      <div className="courses-scrollable">
        {resumable.map((record) => (
          <div className="local-banner" key={record.id}>
            <strong>{record.courseTitle}</strong>
            <span>
              {translate(locale, "unfinishedSession")}{" "}
              {new Date(record.savedAt).toLocaleString(locale)}
            </span>
            <button
              className="gold-button"
              type="button"
              onClick={() => onResume(record)}
            >
              {translate(locale, "resumeLearning")}
            </button>
          </div>
        ))}
        {importNotice && (
          <div className="local-banner import-result" role="status">
            <strong>{importNotice}</strong>
          </div>
        )}
        {errorIssues.length > 0 && (
          <div className="course-errors" role="alert">
            <strong>{translate(locale, "courseNeedsAttention")}</strong>
            {errorIssues.map((entry, index) => (
              <IssueArticle
                locale={locale}
                issue={entry}
                key={`${issueKey(entry)}-${index}`}
              />
            ))}
          </div>
        )}
        {(visibleWarnings.length > 0 || dismissedCount > 0) && (
          <div className="course-warnings">
            <button
              className="course-warnings-toggle"
              type="button"
              aria-expanded={warningsOpen}
              onClick={() => setWarningsOpen((open) => !open)}
            >
              <strong>
                {translate(locale, "courseWarnings")} ({visibleWarnings.length})
              </strong>
              <span>
                {warningsOpen
                  ? translate(locale, "hideDetails")
                  : translate(locale, "showDetails")}
              </span>
            </button>
            {warningsOpen &&
              visibleWarnings.map((entry, index) => (
                <IssueArticle
                  locale={locale}
                  issue={entry}
                  key={`${issueKey(entry)}-${index}`}
                  onDismiss={() => onDismissIssue(entry)}
                  dismissLabel={translate(locale, "dismissWarning")}
                />
              ))}
            {dismissedCount > 0 && (
              <button
                className="course-warnings-restore"
                type="button"
                onClick={onRestoreDismissed}
              >
                {translate(locale, "dismissedWarnings")}: {dismissedCount} ·{" "}
                {translate(locale, "restoreDismissed")}
              </button>
            )}
          </div>
        )}
        <div className="course-grid">
          {courses.map((entry) => (
            <CourseCard
              locale={locale}
              key={entry.id}
              name={entry.title}
              meta={courseCardMeta(locale, entry)}
              symbol={entry.title.slice(0, 1).toUpperCase()}
              onClick={() => void onSelect(entry)}
              onRemove={() => onRemove(entry)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function IssueArticle({
  locale,
  issue,
  onDismiss,
  dismissLabel,
}: {
  locale: Locale;
  issue: CourseIssue;
  onDismiss?(): void;
  dismissLabel?: string;
}) {
  const text =
    issue.code === "ITEM_NAME_EMPTY"
      ? formatItemNameEmpty(
          locale,
          issue.location.row ?? 0,
          issue.params?.filledColumns ?? [],
        )
      : { message: issue.message, suggestion: issue.suggestion };
  return (
    <article>
      <p>
        <b>{issue.code}</b> — {text.message} {text.suggestion}
      </p>
      <small>{formatIssueLocation(locale, issue)}</small>
      {onDismiss && (
        <button className="issue-dismiss" type="button" onClick={onDismiss}>
          {dismissLabel}
        </button>
      )}
    </article>
  );
}

export function courseCardMeta(locale: Locale, entry: CourseListEntry): string {
  if (isLoadedCourse(entry))
    return `${entry.items.length} ${translate(locale, "objects")} / ${entry.columns.length}`;
  return entry.languageCode
    ? entry.languageCode
    : entry.workbookPaths.length > 1
      ? `${entry.workbookPaths.length} XLSX`
      : "XLSX";
}

export function CourseCard({
  locale,
  name,
  meta,
  symbol,
  onClick,
  onRemove,
}: {
  locale: Locale;
  name: string;
  meta: string;
  symbol: string;
  onClick(): void;
  onRemove?(): void;
}) {
  return (
    <article className={`course-card ${name.toLowerCase()}`}>
      <div className="course-art">
        <span>{symbol}</span>
      </div>
      <div className="course-copy">
        <h2>{name}</h2>
        <p>{meta}</p>
        <div className="course-actions">
          <button className="metal-button" type="button" onClick={onClick}>
            {translate(locale, "openCourse")}
          </button>
          {onRemove && (
            <button
              className="course-remove-button"
              type="button"
              aria-label={`${translate(locale, "removeCourse")} ${name}`}
              onClick={onRemove}
            >
              {translate(locale, "removeCourse")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function formatIssueLocation(
  locale: Locale,
  issue: CourseIssue,
): string {
  const parts = [`${translate(locale, "file")}: ${issue.location.file}`];
  if (issue.location.sheet)
    parts.push(`${translate(locale, "sheet")}: ${issue.location.sheet}`);
  if (issue.location.row)
    parts.push(`${translate(locale, "row")}: ${issue.location.row}`);
  if (issue.location.column)
    parts.push(`${translate(locale, "column")}: ${issue.location.column}`);
  return parts.join(" · ");
}
