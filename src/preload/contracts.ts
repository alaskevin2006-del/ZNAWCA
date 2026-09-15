import type { CourseCatalogEntry, CourseLoadReport } from "../core/course/types.js";
import type { CourseOrganizationSummary } from "../core/course/organizer.js";
import type { LocalState } from "../core/persistence/index.js";

export const IPC_CHANNELS = {
  chooseCourse: "course:choose-and-load",
  chooseCourseRoot: "course:choose-root-and-discover",
  scanCourseRoot: "course:scan-saved-root",
  loadCourseFromLibrary: "course:load-from-library",
  loadLocalState: "state:load",
  saveLocalState: "state:save",
} as const;

export interface CourseLibraryReport {
  readonly rootDirectory: string;
  readonly reports: readonly CourseLoadReport[];
  readonly catalog: readonly CourseCatalogEntry[];
  readonly organization?: CourseOrganizationSummary;
}

export type CourseImportMode = "scan" | "organize";

export interface ZnawcaDesktopApi {
  chooseCourse(): Promise<CourseLoadReport | null>;
  chooseCourseRoot?(mode?: CourseImportMode): Promise<CourseLibraryReport | null>;
  scanCourseRoot?(rootDirectory: string): Promise<CourseLibraryReport>;
  loadCourseFromLibrary?(rootDirectory: string, courseDirectory: string, courseId: string): Promise<CourseLoadReport>;
  loadLocalState(): Promise<LocalState>;
  saveLocalState(state: LocalState): Promise<void>;
}
