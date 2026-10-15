import type {
  Course,
  CourseCatalogEntry,
  CourseIssue,
} from "../../core/course/types.js";
import type { CourseLibraryReport } from "../../contracts/desktop-api.js";

export type CourseListEntry = Course | CourseCatalogEntry;

export function isLoadedCourse(entry: CourseListEntry): entry is Course {
  return "items" in entry && "columns" in entry;
}

export function courseCatalogFromLibrary(
  library: CourseLibraryReport,
): CourseCatalogEntry[] {
  if (library.catalog?.length > 0) return [...library.catalog];
  return library.reports.flatMap((report) => {
    if (report.course)
      return [
        courseToCatalogEntry(report.course, report.issues, report.canOpen),
      ];
    if (report.issues.length === 0) return [];
    const file = report.issues[0].location.file;
    return [
      {
        id: `issue-${report.issues[0].code}-${file}`,
        title: file.split(/[\\/]/).filter(Boolean).at(-1) ?? file,
        directory: file,
        workbookPaths: [],
        issues: report.issues,
        canOpen: false,
      },
    ];
  });
}

export function courseIssuesFromLibrary(
  library: CourseLibraryReport,
  catalog: readonly CourseCatalogEntry[],
): readonly CourseIssue[] {
  if (library.catalog?.length > 0)
    return catalog.flatMap((entry) => entry.issues);
  return library.reports.flatMap((report) => report.issues);
}

/** 单条导入问题的稳定指纹：同一文件/行列/列名的问题在重新扫描后指纹不变，可持久化「已忽略」。 */

export function issueKey(issue: CourseIssue): string {
  return [
    issue.code,
    issue.location.file,
    issue.location.sheet ?? "",
    issue.location.row ?? "",
    issue.location.column ?? "",
    issue.location.columnName ?? "",
  ].join("|");
}

export function courseToCatalogEntry(
  course: Course,
  issues: readonly CourseIssue[] = [],
  canOpen = true,
): CourseCatalogEntry {
  return {
    id: course.id,
    title: course.title,
    directory: course.directory,
    workbookPaths: [course.workbookPath],
    languageCode: course.languageCode,
    issues,
    canOpen,
  };
}
