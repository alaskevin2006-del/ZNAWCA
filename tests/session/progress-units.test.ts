import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCourseVersions } from "../../src/core/course/loader.js";
import { buildCourseQuestionSet } from "../../src/core/quiz/question-set.js";
import { progressUnitKey, progressUnitTotal } from "../../src/core/progress/knowledge-progress.js";
import { LearningSession } from "../../src/core/session/learning-session.js";
import { TestingSession } from "../../src/core/session/testing-session.js";
import type { AnswerEvaluation, Question } from "../../src/core/quiz/types.js";
import { createCourseFixture, writeWorkbookRows, JPEG_BYTES } from "../course/xlsx-fixture.js";

// ZNAWCA-15 S4（D-24）自动验收（WORKBUDDY-TASKS.md §6）：
// 1. 同一关系重试多次总数不变。
// 2. 正反向题和不同题型不重复占进度。
// 3. Testing 显示总数/已完成/剩余。
// 另覆盖：空单元格、缺失媒体、无区分度列不计入进度单位。

const correct: AnswerEvaluation = { score: 1, fullyCorrect: true, matched: ["yes"], missed: [], extra: [] };
const wrong: AnswerEvaluation = { score: 0, fullyCorrect: false, matched: [], missed: ["yes"], extra: ["no"] };

const question = (overrides: Partial<Question> & Pick<Question, "id" | "objectId">): Question => ({
  kind: "input",
  direction: "name-to-property",
  prompt: "Question",
  acceptedAnswers: ["yes"],
  ...overrides,
});

describe("progress units: one name+cell relation is one unit (D-24)", () => {
  it("merges forward/reverse directions, question kinds and media variants into one unit", () => {
    const forwardInput = question({ id: "q1", objectId: "cuckoo", field: "Diet" });
    const reverseChoice = question({
      id: "q2", objectId: "cuckoo", field: "Diet",
      direction: "property-to-name", kind: "choice",
    });
    const imageVariantA = question({
      id: "q3", objectId: "cuckoo", direction: "image-to-name",
      media: { kind: "image", path: "media/sparrow.png" },
    });
    const imageVariantB = question({
      id: "q4", objectId: "cuckoo", direction: "image-to-name",
      media: { kind: "image", path: "media/sparrow-flying.jpg" },
    });
    expect(progressUnitKey(forwardInput)).toBe(progressUnitKey(reverseChoice));
    expect(progressUnitKey(imageVariantA)).toBe(progressUnitKey(imageVariantB));
    // 两个学习单元格（Diet 列 + A 列图片）＝两个单位。
    expect(progressUnitTotal([forwardInput, reverseChoice, imageVariantA, imageVariantB])).toBe(2);
  });

  it("keeps the learning total fixed across retries", () => {
    const diet = question({ id: "diet", objectId: "cuckoo", field: "Diet" });
    const image = question({ id: "image", objectId: "cuckoo", direction: "image-to-name", media: { kind: "image", path: "media/cuckoo.jpg" } });
    const session = new LearningSession([diet, image]);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 0, remaining: 2 });
    // 答错 → 重试（重入队尾）：总数不变，已完成仍为 0。
    session.answer("diet", wrong);
    session.answer("image", wrong);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 0, remaining: 2 });
    // 重试答对（首 streak）→ 仍未完成（requiredStreak=2）。
    session.answer("diet", correct);
    session.answer("image", correct);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 0, remaining: 2 });
    // 第二次答对 → 各自单元格单位完成。
    session.answer("diet", correct);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 1, remaining: 1 });
    session.answer("image", correct);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 2, remaining: 0 });
    expect(session.isComplete()).toBe(true);
  });

  it("does not double-count a unit when both its forward and reverse questions complete", () => {
    const forward = question({ id: "f", objectId: "cuckoo", field: "Diet" });
    const reverse = question({ id: "r", objectId: "cuckoo", field: "Diet", direction: "property-to-name" });
    const session = new LearningSession([forward, reverse]);
    session.answer("f", correct);
    session.answer("r", correct);
    expect(session.progressUnits()).toEqual({ total: 1, completed: 1, remaining: 0 });
  });

  it("restores the fixed unit total when resuming from a snapshot (and tolerates legacy snapshots)", () => {
    const diet = question({ id: "diet", objectId: "cuckoo", field: "Diet" });
    const image = question({ id: "image", objectId: "cuckoo", direction: "image-to-name", media: { kind: "image", path: "media/cuckoo.jpg" } });
    const session = new LearningSession([diet, image]);
    session.answer("diet", correct);
    const resumed = new LearningSession(session.snapshot());
    expect(resumed.progressUnits()).toEqual({ total: 2, completed: 1, remaining: 1 });
    // 旧格式快照（无 unitTotal 字段）：从队列+记录重算，不抛错。
    const legacy = new LearningSession({ ...session.snapshot(), unitTotal: undefined });
    expect(legacy.progressUnits().total).toBe(2);
    expect(legacy.progressUnits().completed).toBe(1);
  });

  it("shows total/completed/remaining for testing", () => {
    const dietForward = question({ id: "df", objectId: "cuckoo", field: "Diet" });
    const dietReverse = question({ id: "dr", objectId: "cuckoo", field: "Diet", direction: "property-to-name", kind: "choice" });
    const gullDiet = question({ id: "gd", objectId: "gull", field: "Diet" });
    const session = new TestingSession([dietForward, dietReverse, gullDiet], 0);
    // 正反向合并：3 道题只覆盖 2 个进度单位。
    expect(session.progressUnits()).toEqual({ total: 2, completed: 0, remaining: 2 });
    session.current(100);
    session.submit("df", { evaluation: wrong }, 200);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 1, remaining: 1 });
    // 同一单位的反向题作答后不重复累计。
    session.current(300);
    session.submit("dr", { evaluation: correct }, 400);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 1, remaining: 1 });
    session.current(500);
    session.submit("gd", { evaluation: correct }, 600);
    expect(session.progressUnits()).toEqual({ total: 2, completed: 2, remaining: 0 });
  });
});

describe("progress units: skipped content is not counted (D-24)", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-units-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("excludes empty cells, missing media and non-discriminating columns", async () => {
    const { directory, workbook } = await createCourseFixture(root, "UnitsV2", "Units_Eng.xlsx");
    const rows = [
      ["Birds of Europe", "Name / Bird", "Diet / Food", "Wings / Wing"],
      ["cuckoo.jpg", "Common Cuckoo", "insects", "two"],
      // A 列引用缺失文件 missing.jpg：该对象无媒体题 → 无 media 单位。
      ["missing.jpg", "House Sparrow", "seeds", "two"],
      // Diet 单元格为空：该对象的 Diet 关系不计。
      ["gull.jpg", "European Herring Gull", "", "two"],
    ];
    await writeWorkbookRows(workbook, rows);
    // 两个语言工作簿（Units_Eng/Units_Ru）共享基础名 → 按 V2（单元格媒体模型）展开；
    // 单个语言后缀工作簿同样按 V2 加载（loader D-16 放宽）。
    await writeWorkbookRows(join(directory, "Units_Ru.xlsx"), rows);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(directory, "media"), { recursive: true });
    await writeFile(join(directory, "media", "cuckoo.jpg"), JPEG_BYTES);
    await writeFile(join(directory, "media", "gull.jpg"), JPEG_BYTES);

    const report = (await loadCourseVersions(directory)).find((entry) => entry.course?.languageCode === "Eng")!;
    expect(report.canOpen).toBe(true);
    const course = report.course!;
    const set = buildCourseQuestionSet({ course, teachingStyle: "strict" });
    const units = new Set(set.questions.map(progressUnitKey));

    // 无区分度列（Wings 全部同值）不出题 → 不计。
    expect(set.skippedFields).toContain("Wings / Wing");
    expect([...units].some((unit) => unit.includes("field:Wings"))).toBe(false);
    // 空单元格：gull 的 Diet 关系不计。
    expect([...units].some((unit) => unit.startsWith("european herring gull\u0000field:Diet"))).toBe(false);
    // 缺失媒体：sparrow 无 media:image 单位。
    expect([...units].some((unit) => unit.startsWith("house sparrow\u0000media:"))).toBe(false);
    // 正常关系照常计数：cuckoo 的 Diet 与图片、gull 的图片。
    expect([...units].some((unit) => unit.startsWith("common cuckoo\u0000field:Diet"))).toBe(true);
    expect([...units].some((unit) => unit.startsWith("common cuckoo\u0000media:image"))).toBe(true);
    expect([...units].some((unit) => unit.startsWith("european herring gull\u0000media:image"))).toBe(true);
  });
});
