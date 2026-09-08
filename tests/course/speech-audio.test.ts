import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCourseVersions } from "../../src/core/course/loader.js";
import { buildCourseQuestionSet } from "../../src/core/quiz/question-set.js";
import type { Course } from "../../src/core/course/types.js";
import type { Question } from "../../src/core/quiz/types.js";
import { columnLetters, speechAudioForOption, speechAudioForQuestion } from "../../src/core/course/speech-audio.js";
import { createMultilingualCourseFixture } from "./xlsx-fixture.js";

// ZNAWCA-15 S3 自动验收（WORKBUDDY-TASKS.md §5，D-22）：
// 1. 同一坐标不同语言播放各自录音（speech/Eng 与 speech/Ru 互不串台）。
// 2. 正向与反向题干不播同一段（C1-F.mp3 vs C1-R.mp3）。
// 3. 无朗读文件时静默跳过（返回值缺项 / 空），不启用 TTS。

/** 模拟主进程 withMediaUrls 的转换：file → 可播放 URL（此处用可读的 mock 前缀）。 */
function withSpeech(course: Course): Course {
  if (!course.speechFiles || !course.speechDirectory) return course;
  return {
    ...course,
    speech: course.speechFiles.map((file) => ({ file, url: `mock://${join(course.speechDirectory!, file).replaceAll("\\", "/")}` })),
  };
}

describe("V2 speech directory consumption (D-22)", () => {
  let root: string;
  let directory: string;
  let eng: Course;
  let ru: Course;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-speech-"));
    ({ directory } = await createMultilingualCourseFixture(root));
    const reports = await loadCourseVersions(directory);
    expect(reports.every((report) => report.canOpen)).toBe(true);
    eng = withSpeech(reports.find((report) => report.course?.languageCode === "Eng")!.course!);
    ru = withSpeech(reports.find((report) => report.course?.languageCode === "Ru")!.course!);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("scans the per-language speech directory for coordinate-named audio", async () => {
    for (const course of [eng, ru]) {
      expect(course.speechFiles).toEqual(["B2.mp3", "C1-F.mp3", "C1-R.mp3", "C2.mp3"]);
      expect(course.speechDirectory).toBe(join(directory, "speech", course.languageCode!));
    }
  });

  it("has no speech directory issues and silently scans a missing directory", async () => {
    // speech/Pol 不存在：listSpeechAudioFiles 静默返回空，不产生 issue、不启用 TTS。
    const { directory: noSpeechDir } = await createMultilingualCourseFixture(root);
    await rm(join(noSpeechDir, "speech", "Eng"), { recursive: true, force: true });
    const reports = await loadCourseVersions(noSpeechDir);
    const report = reports.find((entry) => entry.course?.languageCode === "Eng")!;
    expect(report.canOpen).toBe(true);
    expect(report.issues.filter((issue) => issue.code.startsWith("SPEECH"))).toEqual([]);
    expect(report.course?.speechFiles).toEqual([]);
  });

  function questionOf(course: Course, direction: Question["direction"], objectId: string): Question {
    const set = buildCourseQuestionSet({ course, teachingStyle: "strict" });
    const found = set.questions.find((entry) =>
      entry.direction === direction && entry.objectId === objectId && entry.kind === "input");
    expect(found, `expected a ${direction} question for ${objectId}`).toBeDefined();
    return found!;
  }

  it("plays each language's own recording for the same coordinate (B2)", () => {
    const engQuestion = questionOf(eng, "name-to-property", "common cuckoo");
    const ruQuestion = questionOf(ru, "name-to-property", "обыкновенная кукушка");
    const engChain = speechAudioForQuestion(eng, engQuestion);
    const ruChain = speechAudioForQuestion(ru, ruQuestion);
    // 正向题：问题单元格 B2（名称）→ 双向标题 C1-F（正向题干），按显示顺序。
    expect(engChain).toEqual([
      expect.stringContaining("/speech/Eng/B2.mp3"),
      expect.stringContaining("/speech/Eng/C1-F.mp3"),
    ]);
    expect(engChain[0]).not.toBe(ruChain[0]);
  });

  it("plays the forward stem (C1-F) for forward and the reverse stem (C1-R) for reverse questions", () => {
    const forward = questionOf(eng, "name-to-property", "common cuckoo");
    const reverse = questionOf(eng, "property-to-name", "common cuckoo");
    const forwardChain = speechAudioForQuestion(eng, forward);
    const reverseChain = speechAudioForQuestion(eng, reverse);
    // 正向：B2（名称单元格）→ C1-F；反向：C2（属性单元格）→ C1-R。
    expect(forwardChain).toEqual([
      expect.stringContaining("/speech/Eng/B2.mp3"),
      expect.stringContaining("/speech/Eng/C1-F.mp3"),
    ]);
    expect(reverseChain).toEqual([
      expect.stringContaining("/speech/Eng/C2.mp3"),
      expect.stringContaining("/speech/Eng/C1-R.mp3"),
    ]);
    // 正反向题干不播同一段。
    expect(forwardChain[1]).not.toBe(reverseChain[1]);
  });

  it("does not narrate when the question itself is media", () => {
    const set = buildCourseQuestionSet({ course: eng, teachingStyle: "strict" });
    const mediaQuestion = set.questions.find((entry) => entry.media);
    expect(mediaQuestion, "expected a media question in the fixture").toBeDefined();
    expect(speechAudioForQuestion(eng, mediaQuestion!)).toEqual([]);
  });

  it("silently skips coordinates without a recording", () => {
    // 只有 B2/C2/C1-F/C1-R 存在：行 3 的名称单元格 B3 无录音 → 只剩题干片段。
    const question = { ...questionOf(eng, "name-to-property", "house sparrow") };
    const chain = speechAudioForQuestion(eng, question);
    expect(chain).toEqual([expect.stringContaining("/speech/Eng/C1-F.mp3")]);
    // 完全没有 speech 资产的课程：空链（不启用 TTS）。
    expect(speechAudioForQuestion({ ...eng, speech: undefined }, question)).toEqual([]);
  });

  it("resolves option narration cells for text answers", () => {
    const set = buildCourseQuestionSet({ course: eng, teachingStyle: "strict" });
    const forward = set.questions.find((entry) =>
      entry.direction === "name-to-property" && entry.kind === "choice"
      && entry.options?.every((option) => !option.media));
    expect(forward?.options).toBeDefined();
    const cuckooOption = forward!.options!.find((option) => option.objectId === "common cuckoo")!;
    // 正向题的选项是属性值：该对象的属性单元格 C2。
    expect(speechAudioForOption(eng, forward!, cuckooOption)).toContain("/speech/Eng/C2.mp3");

    const reverse = set.questions.find((entry) =>
      entry.direction === "property-to-name" && entry.kind === "choice");
    expect(reverse?.options).toBeDefined();
    const reverseOption = reverse!.options!.find((option) => option.objectId === "common cuckoo")!;
    // 反向题的选项是名称：名称单元格 B2。
    expect(speechAudioForOption(eng, reverse!, reverseOption)).toContain("/speech/Eng/B2.mp3");
  });

  it("maps column indexes to Excel letters", () => {
    expect(columnLetters(1)).toBe("A");
    expect(columnLetters(2)).toBe("B");
    expect(columnLetters(3)).toBe("C");
    expect(columnLetters(27)).toBe("AA");
  });
});
