import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Course,
  CourseCatalogEntry,
  CourseIssue,
} from "../../../core/course/types";
import type { CourseGateway } from "../../../application/courses/ports";
import type { CourseAccess } from "../../../application/courses/course-access";
import type { LocalStateStore } from "../../../application/state/local-state-store";
import {
  courseCatalogFromLibrary,
  courseIssuesFromLibrary,
  courseToCatalogEntry,
  isLoadedCourse,
  type CourseListEntry,
} from "../../../application/courses/catalog";

export function useCourseLibrary(
  store: LocalStateStore,
  ready: boolean,
  gateway: CourseGateway,
  access: CourseAccess,
) {
  const [loadedCourses, setLoadedCourses] = useState<Course[]>([]);
  const [catalog, setCatalog] = useState<CourseCatalogEntry[]>([]);
  const [issues, setIssues] = useState<readonly CourseIssue[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  const remember = (course: Course) =>
    setLoadedCourses((current) => [
      ...current.filter((entry) => entry.id !== course.id),
      course,
    ]);
  const setActiveCourse = (course: Course | undefined) => {
    if (course) remember(course);
    setSelectedId(course?.id);
  };
  const settings = store.getSnapshot().state.settings;
  const entries = useMemo(() => {
    const loaded = new Map(loadedCourses.map((course) => [course.id, course]));
    const result: CourseListEntry[] = catalog.map(
      (entry) => loaded.get(entry.id) ?? entry,
    );
    const ids = new Set(catalog.map((entry) => entry.id));
    result.push(...loadedCourses.filter((course) => !ids.has(course.id)));
    return result.filter(
      (entry) => !settings.removedCourseIds.includes(entry.id),
    );
  }, [catalog, loadedCourses, settings.removedCourseIds]);
  const activeCourse = loadedCourses.find((course) => course.id === selectedId);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const baseline = generation.current;
    const saved = store.getSnapshot().state.settings;
    setCatalog(
      (saved.courseCatalogCache ?? []).filter(
        (entry) => !saved.removedCourseIds.includes(entry.id),
      ),
    );
    if (saved.courseRoot && gateway.scanCourseRoot) {
      void gateway
        .scanCourseRoot(saved.courseRoot)
        .then((library) => {
          if (!active || generation.current !== baseline) return;
          const removed = store.getSnapshot().state.settings.removedCourseIds;
          const found = courseCatalogFromLibrary(library).filter(
            (entry) => !removed.includes(entry.id),
          );
          setCatalog(found);
          setLoadedCourses(
            library.reports.flatMap((report) =>
              report.canOpen && report.course ? [report.course] : [],
            ),
          );
          setIssues(courseIssuesFromLibrary(library, found));
          store.updateSettings({ courseCatalogCache: found });
        })
        .catch(() => {
          /* Cached catalog remains usable when a startup scan fails. */
        });
    }
    return () => {
      active = false;
    };
  }, [ready, store, gateway]);

  const openCourseEntry = async (
    entry: CourseListEntry,
  ): Promise<Course | undefined> => {
    if (isLoadedCourse(entry)) return entry;
    if (!entry.canOpen) {
      setIssues(entry.issues);
      return;
    }
    const loaded = loadedCourses.find((course) => course.id === entry.id);
    if (loaded) return loaded;
    const baseline = generation.current;
    const root =
      store.getSnapshot().state.settings.courseRoot || entry.directory;
    const report = await access.load(root, entry.directory, entry.id);
    if (!mounted.current || baseline !== generation.current || !report) return;
    if (store.getSnapshot().state.settings.removedCourseIds.includes(entry.id))
      return;
    setIssues(report.issues);
    if (!report.canOpen || !report.course) return;
    remember(report.course);
    return report.course;
  };

  const refresh = async () => {
    const root = store.getSnapshot().state.settings.courseRoot;
    if (!root || !gateway.scanCourseRoot) return;
    const baseline = ++generation.current;
    const library = await gateway.scanCourseRoot(root);
    if (!mounted.current || baseline !== generation.current) return;
    const removed = store.getSnapshot().state.settings.removedCourseIds;
    const found = courseCatalogFromLibrary(library).filter(
      (entry) => !removed.includes(entry.id),
    );
    const ids = new Set(found.map((entry) => entry.id));
    const legacy = library.reports.flatMap((report) =>
      report.canOpen && report.course && !removed.includes(report.course.id)
        ? [report.course]
        : [],
    );
    setCatalog(found);
    setLoadedCourses((current) => [
      ...current.filter((course) => ids.has(course.id)),
      ...legacy.filter(
        (course) => !current.some((entry) => entry.id === course.id),
      ),
    ]);
    setIssues(courseIssuesFromLibrary(library, found));
    store.updateSettings({ courseCatalogCache: found });
    if (selectedId && !ids.has(selectedId)) setSelectedId(undefined);
    return ids;
  };

  const add = async (mode?: "scan" | "organize") => {
    const baseline = ++generation.current;
    if (mode && gateway.chooseCourseRoot) {
      const library = await gateway.chooseCourseRoot(mode);
      if (!mounted.current || baseline !== generation.current || !library)
        return;
      const found = courseCatalogFromLibrary(library);
      const courses = library.reports.flatMap((report) =>
        report.canOpen && report.course ? [report.course] : [],
      );
      setCatalog(found);
      setLoadedCourses((current) => [
        ...current.filter(
          (entry) => !courses.some((course) => course.id === entry.id),
        ),
        ...courses,
      ]);
      setIssues(courseIssuesFromLibrary(library, found));
      if (found.length || courses.length) {
        const restored = new Set([
          ...found.map((entry) => entry.id),
          ...courses.map((course) => course.id),
        ]);
        store.update((state) => ({
          ...state,
          settings: {
            ...state.settings,
            courseRoot: library.rootDirectory,
            removedCourseIds: state.settings.removedCourseIds.filter(
              (id) => !restored.has(id),
            ),
            recentCourseId:
              found.find((entry) => entry.canOpen)?.id ?? courses[0]?.id,
            courseCatalogCache: found,
          },
        }));
      }
      return { library };
    }
    const report = await gateway.chooseCourse();
    if (!mounted.current || baseline !== generation.current || !report) return;
    setIssues(report.issues);
    if (report.canOpen && report.course) {
      const course = report.course;
      remember(course);
      setCatalog((current) => [
        ...current.filter((entry) => entry.id !== course.id),
        courseToCatalogEntry(course, report.issues),
      ]);
      store.update((state) => ({
        ...state,
        settings: {
          ...state.settings,
          recentCourseId: course.id,
          removedCourseIds: state.settings.removedCourseIds.filter(
            (id) => id !== course.id,
          ),
        },
      }));
      return { course };
    }
  };

  const remove = (entry: CourseListEntry) => {
    setLoadedCourses((current) =>
      current.filter((course) => course.id !== entry.id),
    );
    setCatalog((current) => current.filter((course) => course.id !== entry.id));
    if (selectedId === entry.id) setSelectedId(undefined);
    store.update((state) => {
      const next = {
        ...state.settings,
        removedCourseIds: [
          ...new Set([...state.settings.removedCourseIds, entry.id]),
        ],
        courseCatalogCache: state.settings.courseCatalogCache?.filter(
          (course) => course.id !== entry.id,
        ),
      };
      if (next.recentCourseId === entry.id) delete next.recentCourseId;
      return { ...state, settings: next };
    });
  };

  const reset = () => {
    generation.current++;
    setLoadedCourses([]);
    setCatalog([]);
    setIssues([]);
    setSelectedId(undefined);
  };
  return {
    loadedCourses,
    entries,
    issues,
    activeCourse,
    setActiveCourse,
    openCourseEntry,
    refresh,
    add,
    remove,
    reset,
  };
}
