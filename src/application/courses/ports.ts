import type { CourseLoadReport } from "../../core/course/types.js";
import type {
  CourseImportMode,
  CourseLibraryReport,
} from "../../contracts/desktop-api.js";

export interface CourseGateway {
  chooseCourse(): Promise<CourseLoadReport | null>;
  chooseCourseRoot?(
    mode: CourseImportMode,
  ): Promise<CourseLibraryReport | null>;
  scanCourseRoot?(root: string): Promise<CourseLibraryReport>;
  loadCourseFromLibrary?(
    root: string,
    directory: string,
    id: string,
  ): Promise<CourseLoadReport>;
}
