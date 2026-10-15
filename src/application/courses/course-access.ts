import type { CourseLoadReport } from "../../core/course/types.js";

export type LoadCourse = (
  root: string,
  directory: string,
  id: string,
) => Promise<CourseLoadReport | undefined>;

/** Only in-flight work is cached; accepted course data belongs to the library model. */
export class CourseAccess {
  private readonly pending = new Map<string, ReturnType<LoadCourse>>();
  constructor(private readonly read: LoadCourse) {}

  load(root: string, directory: string, id: string): ReturnType<LoadCourse> {
    const key = JSON.stringify([root, directory, id]);
    const existing = this.pending.get(key);
    if (existing) return existing;
    let request: ReturnType<LoadCourse>;
    try {
      request = this.read(root, directory, id);
    } catch (error) {
      return Promise.reject(error);
    }
    this.pending.set(key, request);
    const release = () => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    };
    void request.then(release, release);
    return request;
  }
}
