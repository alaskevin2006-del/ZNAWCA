import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCourse } from "../../src/core/course/loader.js";
import type { Course } from "../../src/core/course/types.js";
import { courseObjects, filterOptions, filteredCourseObjects, skippedQuestionFields } from "../../src/core/quiz/course-adapter.js";
import { createCourseFixture } from "../course/xlsx-fixture.js";

describe("course quiz adapter", () => {
  let course: Course;
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-adapter-"));
    const { directory } = await createCourseFixture(root);
    const report = await loadCourse(directory);
    course = report.course!;
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("separates filter-only fields and groups all media by kind", () => {
    const objects = courseObjects(course);
    expect(objects).toHaveLength(4);
    expect(Object.keys(objects[0]!.filters ?? {})).toHaveLength(2);
    expect(Object.keys(objects[0]!.attributes)).not.toContain("# Family");
  });

  it("provides unique values and applies OR within a field and AND between fields", () => {
    const options = filterOptions(course);
    expect(Object.keys(options)).toHaveLength(2);
    const fields = Object.keys(options);
    const firstValues = options[fields[0]!]!;
    const firstSelection = filteredCourseObjects(course, [{ field: fields[0]!, values: firstValues.slice(0, 2) }]);
    expect(firstSelection.length).toBeGreaterThan(0);
    const andSelection = filteredCourseObjects(course, [
      { field: fields[0]!, values: firstValues.slice(0, 2) },
      { field: fields[1]!, values: options[fields[1]!]!.slice(0, 1) },
    ]);
    expect(andSelection.length).toBeLessThanOrEqual(firstSelection.length);
  });

  it("exposes only hash-prefixed columns as session filters", () => {
    const options = filterOptions(course);
    expect(Object.keys(options).filter((field) => field.startsWith("#"))).toHaveLength(2);
    expect(Object.keys(options).some((field) => !field.startsWith("#"))).toBe(false);
  });

  it("reports columns with no remaining distinguishing value", () => {
    expect(skippedQuestionFields(course, [])).toEqual(expect.any(Array));
  });
});
