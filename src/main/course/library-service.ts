import path from "node:path";
import type { CourseLoadReport } from "../../core/course/types.js";
import { discoverCourseCatalog } from "./loader.js";

export async function discoverLibrary(rootDirectory: string) {
  return libraryFromCatalog(
    rootDirectory,
    await discoverCourseCatalog(rootDirectory),
  );
}

export function libraryFromCatalog(
  rootDirectory: string,
  discovered: Awaited<ReturnType<typeof discoverCourseCatalog>>,
) {
  const catalog =
    discovered.length > 0
      ? discovered
      : [catalogFromReport(noCourseCandidates(rootDirectory), rootDirectory)];
  return {
    rootDirectory,
    reports: catalog
      .filter((entry) => !entry.canOpen)
      .map((entry) => ({ canOpen: false, issues: entry.issues })),
    catalog,
  };
}

export function noCourseCandidates(rootDirectory: string): CourseLoadReport {
  return {
    canOpen: false,
    issues: [
      {
        severity: "error",
        code: "COURSE_STRUCTURE_NOT_FOUND",
        message:
          "The selected folder does not yet contain a course that Znawca can create.",
        suggestion:
          "Add an XLSX workbook with a header row and learning content, or choose automatic organization.",
        location: { file: rootDirectory },
      },
    ],
  };
}

export function catalogFromReport(
  report: CourseLoadReport,
  rootDirectory: string,
) {
  return {
    id: "course-structure-not-found",
    title: path.basename(rootDirectory) || rootDirectory,
    directory: rootDirectory,
    workbookPaths: [],
    issues: report.issues,
    canOpen: false,
  };
}
