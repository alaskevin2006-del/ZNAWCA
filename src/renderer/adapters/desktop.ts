import type { ZnawcaDesktopApi } from "../../contracts/desktop-api";
import type { CourseGateway } from "../../application/courses/ports";
import { CourseAccess } from "../../application/courses/course-access";
import { LocalStateStore } from "../../application/state/local-state-store";
import { defaultLocalState } from "../../application/state/defaults";

/** The only renderer boundary that knows about the preload global. */
export function createDesktopServices(
  api: ZnawcaDesktopApi | undefined = window.znawca,
) {
  const courses: CourseGateway = {
    chooseCourse: () => api?.chooseCourse() ?? Promise.resolve(null),
    chooseCourseRoot: api?.chooseCourseRoot
      ? (mode) => api.chooseCourseRoot!(mode)
      : undefined,
    scanCourseRoot: api?.scanCourseRoot
      ? (root) => api.scanCourseRoot!(root)
      : undefined,
    loadCourseFromLibrary: api?.loadCourseFromLibrary
      ? (root, directory, id) => api.loadCourseFromLibrary!(root, directory, id)
      : undefined,
  };
  return {
    state: new LocalStateStore({
      load: () => api?.loadLocalState() ?? Promise.resolve(defaultLocalState()),
      save: (state) => api?.saveLocalState(state) ?? Promise.resolve(),
    }),
    courses,
    courseAccess: new CourseAccess(
      (root, directory, id) =>
        courses.loadCourseFromLibrary?.(root, directory, id) ??
        Promise.resolve(undefined),
    ),
  };
}
