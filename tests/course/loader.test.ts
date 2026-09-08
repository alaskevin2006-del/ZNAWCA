import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discoverCourses, loadCourse, loadCourseVersions } from "../../src/core/course/loader.js";
import { createCourseFixture, createMergedCellFixture } from "./xlsx-fixture.js";

describe("course loader", () => {
  let root: string;
  let directory: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-loader-"));
    ({ directory } = await createCourseFixture(root));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a normalized workbook as an openable course", async () => {
    const report = await loadCourse(directory);
    expect(report.canOpen).toBe(true);
    expect(report.course).toMatchObject({ title: "Fixture", sheetName: "Fixture" });
    expect(report.course?.items).toHaveLength(4);
    expect(report.course?.columns.filter((column) => column.filterOnly)).toHaveLength(2);
    expect(report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("keeps a course open when only one media file is broken", async () => {
    const mediaRoot = await mkdtemp(join(tmpdir(), "znawca-broken-"));
    try {
      const { directory: mediaDirectory } = await createCourseFixture(mediaRoot);
      await mkdir(join(mediaDirectory, "Common Cuckoo", "images"), { recursive: true });
      await writeFile(join(mediaDirectory, "Common Cuckoo", "images", "adult.jpg"), "not a jpeg");
      await mkdir(join(mediaDirectory, "Great Tit", "images"), { recursive: true });
      await writeFile(join(mediaDirectory, "Great Tit", "images", "adult.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

      const report = await loadCourse(mediaDirectory);

      expect(report.canOpen).toBe(true);
      expect(report.issues).toContainEqual(expect.objectContaining({
        code: "MEDIA_CORRUPT",
        severity: "warning",
        location: expect.objectContaining({ file: join(mediaDirectory, "Common Cuckoo", "images", "adult.jpg") }),
      }));
      // 坏媒体只跳过对应媒体；同对象文字列与其他对象的好媒体继续可用。
      expect(report.course?.items.find((item) => item.name === "Common Cuckoo")?.media).toEqual([]);
      expect(report.course?.items.find((item) => item.name === "Great Tit")?.media).toHaveLength(1);
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("blocks a course with no valid learning content and explains the root cause", async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), "znawca-empty-"));
    try {
      const { directory: emptyDirectory, workbook } = await createCourseFixture(
        emptyRoot, "Empty", "Empty.xlsx", [["Name", "Scientific name"]],
      );
      const report = await loadCourse(emptyDirectory);

      expect(report.canOpen).toBe(false);
      expect(report.course).toBeUndefined();
      expect(report.issues).toContainEqual(expect.objectContaining({
        code: "NO_VALID_ITEMS",
        severity: "error",
        message: expect.stringContaining("no valid items"),
        location: expect.objectContaining({ file: workbook, sheet: "Fixture" }),
      }));
    } finally {
      await rm(emptyRoot, { recursive: true, force: true });
    }
  });

  it("does not report ITEM_NAME_EMPTY for a merged A-column cell", async () => {
    const mergedRoot = await mkdtemp(join(tmpdir(), "znawca-merged-"));
    try {
      const { directory: mergedDirectory } = await createMergedCellFixture(mergedRoot);
      const report = await loadCourse(mergedDirectory);
      expect(report.canOpen).toBe(true);
      expect(report.issues.filter((issue) => issue.code === "ITEM_NAME_EMPTY")).toEqual([]);
      expect(report.issues.filter((issue) => issue.code === "ITEM_NAME_DUPLICATE")).toEqual([]);
      // 合并续行的属性并入同名 item，而不是另建重复 item。
      expect(report.course?.items.map((item) => item.name)).toEqual(["Granite", "Basalt"]);
      expect(report.course?.items.find((item) => item.name === "Granite")?.values).toMatchObject({ Type: ["Igneous", "Sedimentary"] });
    } finally {
      await rm(mergedRoot, { recursive: true, force: true });
    }
  });

  it("ignores an Excel lock file when detecting workbooks", async () => {
    const lockRoot = await mkdtemp(join(tmpdir(), "znawca-lock-"));
    try {
      const { directory } = await createCourseFixture(lockRoot);
      await writeFile(join(directory, "~$Fixture.xlsx"), "lock file");
      const report = await loadCourse(directory);
      expect(report.canOpen).toBe(true);
      expect(report.issues.filter((issue) => issue.code === "WORKBOOK_AMBIGUOUS")).toEqual([]);
    } finally {
      await rm(lockRoot, { recursive: true, force: true });
    }
  });

  it("lists workbook filenames when multiple workbooks are present", async () => {
    const multiRoot = await mkdtemp(join(tmpdir(), "znawca-multi-"));
    try {
      const { directory } = await createCourseFixture(multiRoot, "Multi", "First.xlsx");
      await writeFile(join(directory, "Second.xlsx"), "not a real workbook");
      const report = await loadCourse(directory);
      expect(report.canOpen).toBe(false);
      expect(report.issues).toContainEqual(expect.objectContaining({
        code: "WORKBOOK_AMBIGUOUS",
        severity: "error",
        message: expect.stringContaining("First.xlsx"),
        location: expect.objectContaining({ file: directory }),
      }));
      expect(report.issues[0].message).toContain("Second.xlsx");
    } finally {
      await rm(multiRoot, { recursive: true, force: true });
    }
  });

  it("loads multiple language-suffixed workbooks as separate course versions", async () => {
    const langRoot = await mkdtemp(join(tmpdir(), "znawca-lang-"));
    try {
      const { directory } = await createCourseFixture(langRoot, "Birds", "Birds_Eng.xlsx");
      await createCourseFixture(langRoot, "Birds", "Birds_Ru.xlsx");
      const reports = await loadCourseVersions(directory);

      expect(reports).toHaveLength(2);
      expect(reports.every((report) => report.canOpen)).toBe(true);
      const languages = reports.map((report) => report.course?.languageCode).sort();
      expect(languages).toEqual(["Eng", "Ru"]);
      for (const report of reports) {
        expect(report.course?.formatVersion).toBe("v2");
        // 课程 id 含语言后缀，隔离学习记录。
        expect(report.course?.id).toMatch(/birds_(eng|ru)/);
      }
    } finally {
      await rm(langRoot, { recursive: true, force: true });
    }
  });

  it("still reports WORKBOOK_AMBIGUOUS when multiple workbooks do not share a language base", async () => {
    const mixedRoot = await mkdtemp(join(tmpdir(), "znawca-mixed-"));
    try {
      const { directory } = await createCourseFixture(mixedRoot, "Mixed", "Birds_Eng.xlsx");
      await createCourseFixture(mixedRoot, "Mixed", "Plants_Ru.xlsx");
      const report = await loadCourse(directory);
      expect(report.canOpen).toBe(false);
      expect(report.issues).toContainEqual(expect.objectContaining({ code: "WORKBOOK_AMBIGUOUS" }));
    } finally {
      await rm(mixedRoot, { recursive: true, force: true });
    }
  });
});

describe("course discovery", () => {
  let root: string;
  let courseDirectory: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-discovery-"));
    ({ directory: courseDirectory } = await createCourseFixture(root));
    await mkdir(join(root, "Reference material"), { recursive: true });
    await writeFile(join(root, "README.md"), "Library notes");
    await writeFile(join(root, "Unrelated.xlsx"), "Not a course workbook");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("discovers course subdirectories while ignoring non-course files and folders", async () => {
    const reports = await discoverCourses(root);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      canOpen: true,
      course: { title: "Fixture", directory: courseDirectory },
      issues: [],
    });
  });

  it("accepts a single course directory directly", async () => {
    const reports = await discoverCourses(courseDirectory);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      canOpen: true,
      course: { title: "Fixture", directory: courseDirectory },
      issues: [],
    });
  });

  it("ignores a selected directory that contains no course candidates", async () => {
    const emptyRoot = join(root, "Reference material");
    const reports = await discoverCourses(emptyRoot);

    expect(reports).toEqual([]);
  });

  it("rejects a second course with the same workbook title instead of creating an id collision", async () => {
    const duplicateRoot = await mkdtemp(join(tmpdir(), "znawca-duplicate-"));
    try {
      await createCourseFixture(duplicateRoot, "First", "Shared.xlsx");
      await createCourseFixture(duplicateRoot, "Second", "Shared.xlsx");

      const reports = await discoverCourses(duplicateRoot);

      expect(reports).toHaveLength(2);
      expect(reports.filter((report) => report.canOpen)).toHaveLength(1);
      expect(reports.flatMap((report) => report.issues).map((issue) => issue.code))
        .toContain("COURSE_ID_DUPLICATE");
    } finally {
      await rm(duplicateRoot, { recursive: true, force: true });
    }
  });
});
