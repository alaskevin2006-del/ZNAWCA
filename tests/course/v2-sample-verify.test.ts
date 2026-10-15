/**
 * V2 完整测试样例回归：加载 samples/V2-Sample（tools/test-data/generate_v2_sample.py 生成），
 * 用真实 loader/quiz 栈校验 D-01/D-15~D-22/4.2/5.1 各需求点。
 * samples/ 被 gitignore——样例缺失时整组自动跳过，重新生成后即恢复。
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverCourses } from "../../src/main/course/loader.js";
import { courseObjects } from "../../src/core/quiz/course-adapter.js";
import { columnRole, bidirectionalStems } from "../../src/core/quiz/course-adapter.js";
import { applyFilters } from "../../src/core/quiz/filter.js";
import { evaluateAnswer } from "../../src/core/quiz/scoring.js";
import { buildCourseQuestionSet } from "../../src/core/quiz/question-set.js";
import type { Course } from "../../src/core/course/types.js";

const SAMPLE_ROOT = join(process.cwd(), "samples", "V2-Sample");
const hasSample = existsSync(SAMPLE_ROOT); // samples/ 被 gitignore，缺失时整组跳过
const reports = hasSample ? await discoverCourses(SAMPLE_ROOT) : [];
const byId = new Map<string, Course>();
const issuesById = new Map<string, string[]>();
for (const report of reports) {
  issuesById.set(report.course?.id ?? "?", report.issues.map((entry) => `${entry.severity}:${entry.code}`));
  if (report.course) byId.set(report.course.id, report.course);
}

describe.skipIf(!hasSample)("V2-Sample 完整测试样例", () => {

  it("发现 3 门课程（countries_eng / countries_ru / minerals_eng）", () => {
    expect(reports).toHaveLength(3);
    for (const report of reports) {
      expect(report.canOpen, `${report.course?.id ?? "?"} canOpen`).toBe(true);
    }
    expect([...byId.keys()].sort()).toEqual(["countries_eng", "countries_ru", "minerals_eng"]);
  });

  it("三门课程零 issue（无 error 也无 warning）", () => {
    for (const [id, issues] of issuesById) expect(issues, id).toEqual([]);
  });

  it("D-15/D-16：A1 显示名、语言代码、V2 标识、B 列名称", () => {
    const eng = byId.get("countries_eng")!;
    const ru = byId.get("countries_ru")!;
    expect(eng.formatVersion).toBe("v2");
    expect(eng.displayTitle).toBe("Countries of the World");
    expect(ru.displayTitle).toBe("Страны мира");
    expect(eng.languageCode).toBe("Eng");
    expect(ru.languageCode).toBe("Ru");
    expect(eng.items.map((item) => item.name)).toEqual(["Poland", "France", "Germany", "China", "Russia", "Japan"]);
    expect(ru.items.map((item) => item.name)).toEqual(["Польша", "Франция", "Германия", "Китай", "Россия", "Япония"]);
  });

  it("D-17/D-18：主媒体多变体、单元格级属性媒体（图/音/视频）", () => {
    const eng = byId.get("countries_eng")!;
    const poland = eng.items.find((item) => item.name === "Poland")!;
    const landmarkTitle = eng.columns.find((column) => column.title.includes("landmark"))!.title;
    const anthemTitle = eng.columns.find((column) => column.title.includes("anthem"))!.title;
    const videoTitle = eng.columns.find((column) => column.title.includes("video"))!.title;
    expect(poland.media).toHaveLength(2); // pl-flag.png / pl-flag-waving.jpg 同格变体
    expect(poland.media.every((asset) => asset.kind === "image")).toBe(true);
    expect(poland.cellMedia?.[landmarkTitle]).toHaveLength(1);
    expect(poland.cellMedia?.[landmarkTitle]![0]!.kind).toBe("image");
    expect(poland.cellMedia?.[anthemTitle]![0]!.kind).toBe("audio");
    expect(poland.cellMedia?.[videoTitle]![0]!.kind).toBe("video");
  });

  it("D-19/D-21：双向题干两侧非空；$/* 列角色", () => {
    const eng = byId.get("countries_eng")!;
    for (const column of eng.columns.filter((entry) => !entry.filterOnly && entry.index >= 2)) {
      const stems = bidirectionalStems(column.title);
      expect(stems?.forward, column.title).toBeTruthy();
      expect(stems?.reverse, column.title).toBeTruthy();
    }
    const codeTitle = eng.columns.find((column) => column.title.startsWith("*"))!.title;
    const animalTitle = eng.columns.find((column) => column.title.startsWith("$"))!.title;
    expect(columnRole(codeTitle)).toBe("answer-only");
    expect(columnRole(animalTitle)).toBe("question-only");
  });

  it("5.1：# 筛选列 OR（列内）/ AND（列间）", () => {
    const eng = byId.get("countries_eng")!;
    const objects = courseObjects(eng);
    const continent = eng.columns.find((column) => column.title.startsWith("#Continent"))!.title;
    const eurozone = eng.columns.find((column) => column.title.startsWith("#Eurozone"))!.title;
    expect(applyFilters(objects, [{ field: continent, values: ["Europe"] }])).toHaveLength(4);
    expect(applyFilters(objects, [{ field: continent, values: ["Europe", "Asia"] }])).toHaveLength(6);
    expect(applyFilters(objects, [
      { field: continent, values: ["Europe"] },
      { field: eurozone, values: ["Yes"] },
    ])).toHaveLength(2);
  });

  it("D-20：别名任选、`;` 必答组、顺序无关、兼容标点", () => {
    const eng = byId.get("countries_eng")!;
    const china = eng.items.find((item) => item.name === "China")!;
    const currencyTitle = eng.columns.find((column) => column.title.includes("currency"))!.title;
    const currency = china.values[currencyTitle]!;
    expect(currency).toEqual(["Renminbi/Yuan"]);
    expect(evaluateAnswer(currency, "Yuan").score).toBe(1);
    expect(evaluateAnswer(currency, "Renminbi").score).toBe(1);
    expect(evaluateAnswer(currency, "Renminbi; Yuan").score).toBe(1);
    expect(evaluateAnswer(currency, "Euro").score).toBe(0);
    const poland = eng.items.find((item) => item.name === "Poland")!;
    const colorsTitle = eng.columns.find((column) => column.title.includes("colors"))!.title;
    expect(evaluateAnswer(poland.values[colorsTitle]!, "Red， White").score).toBe(1);
    expect(evaluateAnswer(poland.values[colorsTitle]!, "Red").score).toBeLessThan(1);
  });

  it("4.2：化学式下标等价（SiO₂=SiO2；x²≠x2）", () => {
    const minerals = byId.get("minerals_eng")!;
    const quartz = minerals.items.find((item) => item.name === "Quartz")!;
    const formulaTitle = minerals.columns.find((column) => column.title.includes("formula"))!.title;
    expect(evaluateAnswer(quartz.values[formulaTitle]!, "SiO2").score).toBe(1);
    expect(evaluateAnswer(quartz.values[formulaTitle]!, "SiO₂").score).toBe(1);
    expect(evaluateAnswer(["x²"], "x2").score).toBe(0);
  });

  it("D-12/D-22：正误提示音（含 Minerals）与分语言朗读目录", () => {
    const eng = byId.get("countries_eng")!;
    const ru = byId.get("countries_ru")!;
    const minerals = byId.get("minerals_eng")!;
    expect(eng.feedbackSounds).toBeDefined();
    expect(minerals.feedbackSounds).toBeDefined();
    expect(eng.feedbackSounds!.correct).toHaveLength(2);
    expect(eng.feedbackSounds!.incorrect).toHaveLength(2);
    expect(minerals.feedbackSounds!.correct).toHaveLength(2);
    expect(minerals.feedbackSounds!.incorrect).toHaveLength(2);
    expect(eng.speechFiles).toContain("B1-F.wav");
    expect(eng.speechFiles).toContain("C4.wav");
    expect(eng.speechFiles).toContain("D1-F.wav");   // D 列（国旗颜色）朗读坐标
    expect(eng.speechFiles).toContain("H1-R.wav");   // H 列（货币）反向题干朗读
    expect(ru.speechFiles).toContain("B1-F.wav");
    expect(eng.speechDirectory).toBeDefined();
    expect(ru.speechDirectory).toBeDefined();
    expect(eng.speechDirectory!.endsWith("speech\\Eng") || eng.speechDirectory!.endsWith("speech/Eng")).toBe(true);
    expect(ru.speechDirectory!.endsWith("speech\\Ru") || ru.speechDirectory!.endsWith("speech/Ru")).toBe(true);
  });

  it("D-01 + 出题：题集可构建；歧义反向（Euro / White; Red）被跳过，正向保留", () => {
    const eng = byId.get("countries_eng")!;
    const set = buildCourseQuestionSet({ course: eng, teachingStyle: "strict" });
    expect(set.availability.generated).toBeGreaterThan(0);
    const currencyTitle = eng.columns.find((column) => column.title.includes("currency"))!.title;
    const colorsTitle = eng.columns.find((column) => column.title.includes("colors"))!.title;
    const codeTitle = eng.columns.find((column) => column.title.startsWith("*"))!.title;
    const animalTitle = eng.columns.find((column) => column.title.startsWith("$"))!.title;
    const reverseFields = new Set(set.questions.filter((question) => question.direction === "property-to-name").map((question) => question.field));
    const france = eng.items.find((item) => item.name === "France")!;
    const germany = eng.items.find((item) => item.name === "Germany")!;
    const poland = eng.items.find((item) => item.name === "Poland")!;
    const japan = eng.items.find((item) => item.name === "Japan")!;
    // D-01：Euro（法德同值）与 White; Red（波兰/日本同值）的反向题被跳过
    const currencyReverse = set.questions.filter((question) => question.direction === "property-to-name" && question.field === currencyTitle);
    expect(currencyReverse.some((question) => question.objectId === france.id || question.objectId === germany.id)).toBe(false);
    const colorsReverse = set.questions.filter((question) => question.direction === "property-to-name" && question.field === colorsTitle);
    expect(colorsReverse.some((question) => question.objectId === poland.id || question.objectId === japan.id)).toBe(false);
    // 唯一值（Zloty 等）的反向题保留
    expect(currencyReverse.length).toBeGreaterThan(0);
    expect(reverseFields.has(animalTitle)).toBe(true);    // $ 仅作问题 → 反向保留
    expect(reverseFields.has(codeTitle)).toBe(false);     // * 仅作答案 → 反向不生成
    const forwardFields = new Set(set.questions.filter((question) => question.direction === "name-to-property").map((question) => question.field));
    expect(forwardFields.has(currencyTitle)).toBe(true);
    expect(forwardFields.has(codeTitle)).toBe(true);
    expect(forwardFields.has(animalTitle)).toBe(false);    // $ 仅作问题 → 正向不生成
  });
});
