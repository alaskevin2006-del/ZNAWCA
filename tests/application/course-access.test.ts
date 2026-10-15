import { describe, expect, it, vi } from "vitest";
import { CourseAccess } from "../../src/application/courses/course-access";
import type { CourseLoadReport } from "../../src/core/course/types";

describe("course loading boundary", () => {
  it("shares an in-flight request and permits a retry after rejection", async () => {
    let reject!: (error: Error) => void;
    const first = new Promise<CourseLoadReport>((_, no) => {
      reject = no;
    });
    const load = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValue({ canOpen: false, issues: [] });
    const access = new CourseAccess(load);
    const a = access.load("root", "course", "id");
    const b = access.load("root", "course", "id");
    expect(a).toBe(b);
    reject(new Error("unreadable"));
    await expect(a).rejects.toThrow("unreadable");
    await access.load("root", "course", "id");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
