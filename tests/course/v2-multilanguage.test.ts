import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCourse, loadCourseVersions } from "../../src/core/course/loader.js";
import { courseObjects } from "../../src/core/quiz/course-adapter.js";
import { generateQuestion } from "../../src/core/quiz/generator.js";
import type { CourseLoadReport } from "../../src/core/course/types.js";
import type { RandomSource } from "../../src/core/quiz/types.js";
import { createCourseFixture, createMultilingualCourseFixture, JPEG_BYTES, MP3_BYTES, writeWorkbookRows } from "./xlsx-fixture.js";

// ZNAWCA-15 S1 自动验收（WORKBUDDY-TASKS.md §3）：
// 1. A1 在不同语言工作簿显示不同课程名。
// 2. 英语/俄语工作簿可引用同一张图片。
// 3. 单元格 `/` 分隔的多张图片不互为干扰项。
// 4. 混合媒体类别（图片+文字）导入失败并精确指出列和单元格。
// 5. V1 课程按旧模型只读兼容，不报错。

const fixed: RandomSource = { next: () => 0 };

function byLanguage(reports: readonly CourseLoadReport[], language: string): CourseLoadReport {
  // 导入失败时 course 为 undefined，改按工作簿文件名（Birds_<lang>.xlsx）识别语言版本。
  const report = reports.find((entry) => entry.course?.languageCode === language)
    ?? reports.find((entry) => !entry.course && entry.issues.some((issue) => issue.location.file?.includes(`_${language}.xlsx`)));
  expect(report, `expected a loaded ${language} course version`).toBeDefined();
  return report!;
}

describe("V2 multilingual course model (D-15~D-18)", () => {
  let root: string;
  let directory: string;
  let mediaDirectory: string;
  let engWorkbook: string;
  let ruWorkbook: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-v2multi-"));
    ({ directory, mediaDirectory, engWorkbook, ruWorkbook } = await createMultilingualCourseFixture(root));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("shows a different A1 course display title per language workbook (D-15/D-16)", async () => {
    const reports = await loadCourseVersions(directory);
    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.canOpen)).toBe(true);
    expect(reports.flatMap((report) => report.issues)).toEqual([]);

    const eng = byLanguage(reports, "Eng");
    const ru = byLanguage(reports, "Ru");
    expect(eng.course?.displayTitle).toBe("Birds of Europe");
    expect(ru.course?.displayTitle).toBe("Птицы Европы");
    // 格式版本标识区分 V1/V2；课程 id 含语言后缀以隔离学习记录。
    for (const report of [eng, ru]) {
      expect(report.course?.formatVersion).toBe("v2");
      expect(report.course?.nameColumnIndex).toBe(2);
    }
    expect(eng.course?.id).toBe("birds_eng");
    expect(ru.course?.id).toBe("birds_ru");
    // 分语言 speech/<lang>/ 目录结构（D-16）。
    expect(eng.course?.speechDirectory).toBe(join(directory, "speech", "Eng"));
    expect(ru.course?.speechDirectory).toBe(join(directory, "speech", "Ru"));
  });

  it("lets the Eng and Ru workbooks reference the same shared image (D-16)", async () => {
    const reports = await loadCourseVersions(directory);
    const engCuckoo = byLanguage(reports, "Eng").course?.items.find((item) => item.name === "Common Cuckoo");
    const ruCuckoo = byLanguage(reports, "Ru").course?.items.find((item) => item.name === "Обыкновенная кукушка");
    expect(engCuckoo?.media).toHaveLength(1);
    expect(ruCuckoo?.media).toHaveLength(1);
    expect(engCuckoo?.media[0]?.path).toBe(join(mediaDirectory, "cuckoo.jpg"));
    expect(engCuckoo?.media[0]?.path).toBe(ruCuckoo?.media[0]?.path);
  });

  it("keeps /-separated image variants of one cell from becoming distractors of each other (D-17/D-18)", async () => {
    const report = await loadCourse(directory);
    expect(report.canOpen).toBe(true);
    const course = report.course!;

    // 变体解析为同一 item 的主媒体（同类别图片，可混用 PNG/JPG），不进入文字答案。
    const sparrow = course.items.find((item) => item.name === "House Sparrow")!;
    expect(sparrow.media.map((asset) => asset.kind)).toEqual(["image", "image"]);
    expect(sparrow.media.map((asset) => asset.path)).toEqual([
      join(mediaDirectory, "sparrow.png"),
      join(mediaDirectory, "sparrow-flying.jpg"),
    ]);

    const objects = courseObjects(course);
    const sparrowObject = objects.find((object) => object.name === "House Sparrow")!;
    const question = generateQuestion({
      target: sparrowObject,
      direction: "name-to-image",
      requestedKind: "choice",
      filteredObjects: objects,
      allCourseObjects: objects,
      teachingStyle: "strict",
      random: fixed,
    });
    expect(question.kind).toBe("choice");
    expect(question.options).toBeDefined();
    // 该 item 只贡献一个选项；未选中的变体绝不作为干扰项出现。
    const sparrowOptions = question.options!.filter((option) => option.objectId === sparrowObject.id);
    expect(sparrowOptions).toHaveLength(1);
    const unusedVariant = (sparrowObject.media?.image ?? []).find((path) => path !== sparrowOptions[0]!.value);
    expect(unusedVariant).toBeDefined();
    expect(question.options!.map((option) => option.value)).not.toContain(unusedVariant);
    // 干扰项只来自其他对象，正误选项互不混淆。
    const otherIds = new Set(objects.filter((object) => object.id !== sparrowObject.id).map((object) => object.id));
    for (const option of question.options!) {
      if (option.objectId !== sparrowObject.id) expect(otherIds.has(option.objectId)).toBe(true);
    }
  });
});

describe("V2 mixed media category rejection (D-18)", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-v2mixed-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("fails import and points at the exact column and cell mixing media with text", async () => {
    const { directory, engWorkbook } = await createMultilingualCourseFixture(root);
    await writeWorkbookRows(engWorkbook, [
      ["Birds of Europe", "Name / Bird", "Diet / Food"],
      ["cuckoo.jpg", "Common Cuckoo", "cuckoo.jpg"],
      ["gull.jpg", "European Herring Gull", "fish"],
    ]);
    const reports = await loadCourseVersions(directory);
    const eng = byLanguage(reports, "Eng");
    expect(eng.canOpen).toBe(false);
    expect(eng.course).toBeUndefined();
    expect(eng.issues).toContainEqual(expect.objectContaining({
      code: "COLUMN_MEDIA_MIXED_KIND",
      severity: "error",
      location: expect.objectContaining({ file: engWorkbook, row: 3, column: 3, columnName: "Diet / Food" }),
    }));
    // 另一语言版本不受影响，仍可打开。
    expect(byLanguage(reports, "Ru").canOpen).toBe(true);
  });

  it("fails import when a single cell mixes an image reference with plain text", async () => {
    const { directory, engWorkbook } = await createMultilingualCourseFixture(root);
    await writeWorkbookRows(engWorkbook, [
      ["Birds of Europe", "Name / Bird", "Diet / Food"],
      ["cuckoo.jpg", "Common Cuckoo", "cuckoo.jpg/insects"],
      ["gull.jpg", "European Herring Gull", "fish"],
    ]);
    const reports = await loadCourseVersions(directory);
    const eng = byLanguage(reports, "Eng");
    expect(eng.canOpen).toBe(false);
    expect(eng.issues).toContainEqual(expect.objectContaining({
      code: "CELL_MEDIA_MIXED_KIND",
      severity: "error",
      location: expect.objectContaining({ file: engWorkbook, row: 2, column: 3, columnName: "Diet / Food" }),
    }));
  });
});

describe("V1 read-only compatibility (D-15)", () => {
  it("loads a V1 course under the legacy model without any issues", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-v1compat-"));
    try {
      const { directory } = await createCourseFixture(root);
      const report = await loadCourse(directory);
      expect(report.canOpen).toBe(true);
      expect(report.issues).toEqual([]);
      expect(report.course?.formatVersion).toBe("v1");
      expect(report.course?.nameColumnIndex).toBe(1);
      expect(report.course?.items).toHaveLength(4);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("V2 cell media reaches question generation (single-language V2)", () => {
  it("generates media questions from cellMedia columns in one language workbook", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-cellmedia-"));
    try {
      const { directory } = await createCourseFixture(root, "CellMedia", "CellMedia_Eng.xlsx", [
        ["Birds of Europe", "Name / Bird", "Diet / Food", "Song / Recording"],
        ["cuckoo.jpg", "Common Cuckoo", "insects", "cuckoo-song.mp3"],
        ["gull.jpg", "European Herring Gull", "fish", "gull-song.mp3"],
        ["sparrow.jpg", "House Sparrow", "seeds", "sparrow-song.mp3"],
      ]);
      // 共享 media/：A 列主媒体（图片）与单元格媒体（音频）。
      await mkdir(join(directory, "media"), { recursive: true });
      await writeFile(join(directory, "media", "cuckoo.jpg"), JPEG_BYTES);
      await writeFile(join(directory, "media", "gull.jpg"), JPEG_BYTES);
      await writeFile(join(directory, "media", "sparrow.jpg"), JPEG_BYTES);
      await writeFile(join(directory, "media", "cuckoo-song.mp3"), MP3_BYTES);
      await writeFile(join(directory, "media", "gull-song.mp3"), MP3_BYTES);
      await writeFile(join(directory, "media", "sparrow-song.mp3"), MP3_BYTES);
      // 单个语言后缀工作簿 → 单语言 V2（D-16 放宽后不再要求多语言工作簿）。
      const reports = await loadCourseVersions(directory);
      expect(reports).toHaveLength(1);
      expect(reports[0]?.canOpen).toBe(true);
      expect(reports[0]?.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      const course = reports[0]!.course!;
      expect(course.formatVersion).toBe("v2");

      const cuckoo = course.items.find((item) => item.name === "Common Cuckoo")!;
      // 属性单元格媒体解析为 cellMedia（不进入文字答案）。
      expect(cuckoo.cellMedia?.["Song / Recording"]?.map((asset) => asset.kind)).toEqual(["audio"]);
      expect(cuckoo.values["Song / Recording"]).toEqual([]);

      const { buildCourseQuestionSet } = await import("../../src/core/quiz/question-set.js");
      const objects = courseObjects(course);
      const cuckooObject = objects.find((object) => object.name === "Common Cuckoo")!;
      // courseObjects 把 cellMedia 并入媒体池：音频可用于 name-to-audio / audio-to-name。
      expect(cuckooObject.media?.audio).toEqual([
        join(directory, "media", "cuckoo-song.mp3"),
      ]);
      expect(cuckooObject.media?.image).toEqual([join(directory, "media", "cuckoo.jpg")]);

      const set = buildCourseQuestionSet({ course, teachingStyle: "strict" });
      // 媒体列出题：音频题（单元格媒体）与图片题（A 列主媒体）都生成。
      expect(set.questions.some((entry) =>
        entry.direction === "name-to-audio" && entry.objectId === "common cuckoo")).toBe(true);
      expect(set.questions.some((entry) =>
        entry.direction === "audio-to-name" && entry.objectId === "common cuckoo")).toBe(true);
      expect(set.questions.some((entry) =>
        entry.direction === "image-to-name" && entry.objectId === "common cuckoo")).toBe(true);
      // 文字题不受影响：Diet 列照常出题。
      expect(set.questions.some((entry) =>
        entry.direction === "name-to-property" && entry.objectId === "common cuckoo")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
