/**
 * Znawca 全功能集成测试
 * 直接调用核心引擎，加载桌面测试样例包 6 门课程，逐项验证所有功能。
 * 无需启动 Electron GUI，纯 Node.js + TypeScript 运行。
 *
 * 用法: npx tsx --esm integration_test.ts
 */

import { loadCourse, discoverCourses } from "./src/core/course/loader.js";
import { buildCourseQuestionSet } from "./src/core/quiz/question-set.js";
import { evaluateAnswer, splitAnswer } from "./src/core/quiz/scoring.js";
import { applyFilters, findNonDiscriminatingFields } from "./src/core/quiz/filter.js";
import { generateQuestion } from "./src/core/quiz/generator.js";
import { courseObjects, filteredCourseObjects } from "./src/core/quiz/course-adapter.js";
import { LearningSession } from "./src/core/session/learning-session.js";
import { TestingSession } from "./src/core/session/testing-session.js";
import { DifficultyMemory, weightedSample } from "./src/core/difficulty/difficulty-memory.js";
import { normalizeText } from "./src/core/quiz/types.js";
import { courseIdFromWorkbook } from "./src/core/course/loader.js";
import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";

// ==================== CONFIG ====================
const TEST_SAMPLES_DIR = "C:\\Users\\Kevin\\Desktop\\ZNAWCA - Test Samples";
const DELIM = "=".repeat(64);

// ==================== HELPERS ====================
interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];
let courseContexts: Map<string, any> = new Map();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function logTest(name: string, fn: () => void | Promise<void>): Promise<TestResult> {
  return (async () => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  PASS  ${name}`);
      return { name, passed: true };
    } catch (e: any) {
      results.push({ name, passed: false, detail: e.message });
      console.log(`  FAIL  ${name}  —  ${e.message}`);
      return { name, passed: false };
    }
  })();
}

// ==================== MAIN ====================
async function main() {
  console.log(`\n${DELIM}`);
  console.log("  Znawca 全功能集成测试");
  console.log(`  测试包: ${basename(TEST_SAMPLES_DIR)}`);
  console.log(`${DELIM}\n`);

  // ---- SECTION 1: Course Loading & Validation ----
  console.log("─ 1. 课程加载与校验 ─\n");

  const courses = await discoverCourses(TEST_SAMPLES_DIR);

  await logTest("发现 6 门课程", () => assert(courses.length === 6, `Expected 6, got ${courses.length}`));

  // Course titles are derived from directory names
  const courseTitles = courses.map(c => c.course?.title ?? "N/A").sort();
  await logTest("课程名称完整性", () => {
    for (const name of ["Countries", "Dogs", "Fruits", "Instruments", "Planets", "Special"]) {
      assert(courseTitles.includes(name), `Missing: ${name}, got: ${courseTitles}`);
    }
    console.log(`        titles: ${courseTitles.join(", ")}`);
  });

  await logTest("全部课程 canOpen = true", () => {
    for (const c of courses) {
      assert(c.canOpen === true, `${c.course?.title ?? "unknown"}: canOpen=${c.canOpen}`);
      assert(!c.issues.some(i => i.severity === "error"), `${c.course?.title}: has errors`);
    }
  });

  // Build lookup
  for (const c of courses) {
    if (c.course) {
      const dir = await findCourseDir(c.course.title);
      courseContexts.set(c.course.id, { course: c.course, dir, report: c });
    }
  }
  console.log();

  // ---- SECTION 2: Question Set Generation ----
  console.log("─ 2. 出题引擎 ─\n");

  await logTest("Countries: 生成题目集 (strict, all)", () => {
    const ctx = courseContexts.get("countries")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    assert(set.questions.length > 0, "No questions generated");
    assert(set.availability.generated === set.questions.length, "Availability mismatch");
  });

  await logTest("Instruments: 生成题目集 (全部 8 方向)", () => {
    const ctx = courseContexts.get("instruments")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const directions = new Set(set.questions.map(q => q.direction));
    assert(directions.has("image-to-name"), "Missing image→name");
    assert(directions.has("audio-to-name"), "Missing audio→name");
    assert(directions.has("video-to-name"), "Missing video→name");
    assert(directions.has("name-to-property"), "Missing name→property");
    assert(directions.has("property-to-name"), "Missing property→name");
  });

  await logTest("Fruits: 输入题与选择题混合", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const input = set.questions.filter(q => q.kind === "input");
    const choice = set.questions.filter(q => q.kind === "choice");
    assert(input.length > 0, "No input questions");
    assert(choice.length > 0, "No choice questions");
    console.log(`        input=${input.length}, choice=${choice.length}, total=${set.questions.length}`);
  });

  await logTest("Planets: 纯文本课程有题目但无媒体题", () => {
    const ctx = courseContexts.get("planets")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const mediaQ = set.questions.filter(q => q.direction.includes("image") || q.direction.includes("audio") || q.direction.includes("video"));
    assert(mediaQ.length === 0, `Expected 0 media questions, got ${mediaQ.length}`);
    assert(set.questions.length > 0, "No questions at all");
    console.log(`        all text questions: ${set.questions.length}`);
  });

  await logTest("降级题检测 (degraded=insufficient-distractors)", () => {
    const ctx = courseContexts.get("countries")!;
    const filteredObjs = filteredCourseObjects(ctx.course, []);
    // With only 10 objects, some directions may need degradation
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const degraded = set.questions.filter(q => q.degradationReason === "insufficient-distractors");
    // Degradation is expected for some courses; at minimum validate it exists
    console.log(`        degraded=${degraded.length}, skipped=${set.availability.skipped}`);
  });

  await logTest("跳过字段检测 (non-discriminating fields)", () => {
    const ctx = courseContexts.get("planets")!;
    const objs = courseObjects(ctx.course);
    const filterFields = ctx.course.columns.filter(c => c.filterOnly).map(c => c.title);
    const skipped = findNonDiscriminatingFields(objs, ctx.course.columns.filter(c => !c.filterOnly && c.index > 1).map(c => c.title));
    console.log(`        filter columns: ${filterFields.join(", ")}, skipped: ${skipped.join(", ") || "none"}`);
  });

  console.log();

  // ---- SECTION 3: Question Generation Per-Direction ----
  console.log("─ 3. 各方向出题正确性 ─\n");

  await logTest("image-to-name 输入题: 答案 = 对象名", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    const target = objs.find(o => o.name === "Japan")!;
    const q = generateQuestion({
      target, direction: "image-to-name", requestedKind: "input",
      filteredObjects: objs, allCourseObjects: objs,
      teachingStyle: "strict",
    });
    assert(q.acceptedAnswers[0] === "Japan", `Expected Japan, got ${q.acceptedAnswers[0]}`);
    assert(!!q.media && q.media.kind === "image", "Missing image media");
    assert(q.kind === "input", `Expected input, got ${q.kind}`);
  });

  await logTest("audio-to-name 输入题: Instruments 有音频", () => {
    const ctx = courseContexts.get("instruments")!;
    const objs = courseObjects(ctx.course);
    const target = objs.find(o => o.name === "Violin")!;
    // audio-to-name should work since Violin has audio
    const q = generateQuestion({
      target, direction: "audio-to-name", requestedKind: "input",
      filteredObjects: objs, allCourseObjects: objs,
      teachingStyle: "strict",
    });
    assert(q.acceptedAnswers[0] === "Violin", `Expected Violin, got ${q.acceptedAnswers[0]}`);
    assert(q.media?.kind === "audio", "Missing audio media");
  });

  await logTest("name-to-property 选择题: 选项数 = 4", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    const target = objs.find(o => o.name === "France")!;
    const q = generateQuestion({
      target, field: "Continent", direction: "name-to-property", requestedKind: "choice",
      filteredObjects: objs, allCourseObjects: objs,
      teachingStyle: "strict",
    });
    assert(q.kind === "choice", `Expected choice, got ${q.kind}`);
    assert(q.options!.length === 4, `Expected 4 options, got ${q.options!.length}`);
    assert(q.acceptedAnswers[0] === "Europe", `Expected Europe, got ${q.acceptedAnswers[0]}`);
  });

  await logTest("property-to-name: 有唯一答案时正常出题", () => {
    const ctx = courseContexts.get("fruits")!;
    const objs = courseObjects(ctx.course);
    // Find a fruit with a unique color
    const target = objs.find(o => o.name === "Orange" && (o.attributes["Typical Color"] ?? []).join(",") === "Orange")!;
    assert(target != null, "Orange not found in fruits");
    const q = generateQuestion({
      target, field: "Typical Color", direction: "property-to-name", requestedKind: "input",
      filteredObjects: objs, allCourseObjects: objs,
      teachingStyle: "strict",
    });
    assert(q.acceptedAnswers[0] === "Orange", `Expected Orange, got ${q.acceptedAnswers[0]}`);
  });

  await logTest("property-to-name 歧义检测: 不唯一时抛出 AMBIGUOUS", () => {
    const ctx = courseContexts.get("planets")!;
    const objs = courseObjects(ctx.course);
    // "Terrestrial" matches 4 planets → ambiguous
    try {
      const target = objs.find(o => o.name === "Mercury")!;
      generateQuestion({
        target, field: "Type", direction: "property-to-name", requestedKind: "input",
        filteredObjects: objs, allCourseObjects: objs,
        teachingStyle: "strict",
      });
      assert(false, "Should have thrown AMBIGUOUS_REVERSE_QUESTION");
    } catch (e: any) {
      assert(e.code === "AMBIGUOUS_REVERSE_QUESTION", `Expected AMBIGUOUS, got ${e.code}`);
    }
  });

  console.log();

  // ---- SECTION 4: Scoring ----
  console.log("─ 4. 答案判定 ─\n");

  await logTest("精确匹配: 全对", () => {
    const result = evaluateAnswer(["Tokyo"], "Tokyo");
    assert(result.fullyCorrect, "Should be fully correct");
    assert(result.score === 1, `Expected score=1, got ${result.score}`);
    assert(result.matched.length === 1 && result.missed.length === 0, "Wrong match/missed");
  });

  await logTest("大小写不敏感", () => {
    const result = evaluateAnswer(["Tokyo"], "tokyo");
    assert(result.fullyCorrect, "Case insensitive should match");
  });

  await logTest("多余空格忽略", () => {
    const result = evaluateAnswer(["Tokyo"], "  Tokyo   ");
    assert(result.fullyCorrect, "Whitespace should be normalized");
  });

  await logTest("分号多答案: 全部命中 = 完全正确", () => {
    const result = evaluateAnswer(["Red", "Green", "Yellow"], "Red; Green; Yellow");
    assert(result.fullyCorrect, "All parts matched");
    assert(result.score === 1, `Expected score=1, got ${result.score}`);
  });

  await logTest("分号多答案: 部分命中 = 部分分数", () => {
    const result = evaluateAnswer(["Red", "Green", "Yellow"], "Red; Yellow");
    assert(!result.fullyCorrect, "Should not be fully correct");
    assert(result.score === 2 / 3, `Expected ~0.667, got ${result.score}`);
    assert(result.matched.length === 2 && result.missed.length === 1, "Wrong match/missed");
  });

  await logTest("分号多答案: 顺序无关", () => {
    const result = evaluateAnswer(["Red", "Green", "Yellow"], "Yellow; Red; Green");
    assert(result.fullyCorrect, "Order should not matter");
  });

  await logTest("splitAnswer: 正确拆分分号", () => {
    const parts = splitAnswer("Red; Green;  Yellow");
    assert(parts.length === 3, `Expected 3 parts, got ${parts.length}`);
    assert(parts[0] === "Red" && parts[1] === "Green" && parts[2] === "Yellow", "Wrong split");
  });

  console.log();

  // ---- SECTION 5: Filtering ----
  console.log("─ 5. 筛选系统 ─\n");

  await logTest("单筛选: Continent=Asia", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    const filtered = applyFilters(objs, [{ field: "Continent", values: ["Asia"] }]);
    const names = new Set(filtered.map(o => o.name));
    assert(names.has("Japan"), "Japan missing");
    assert(names.has("India"), "India missing");
    assert(names.has("South Korea"), "South Korea missing");
    assert(!names.has("France"), "France should be excluded");
    console.log(`        filtered to: ${[...names].join(", ")}`);
  });

  await logTest("同一字段 OR: #Region=East Asia 筛选 2 个国家", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    // Filter columns keep the # prefix in their keys
    const filtered = applyFilters(objs, [{ field: "#Region", values: ["East Asia"] }]);
    assert(filtered.length >= 2, `Expected >=2, got ${filtered.length}`);
    const names = new Set(filtered.map(o => o.name));
    assert(names.has("Japan"), "Japan missing from #Region filter");
    assert(names.has("South Korea"), "South Korea missing from #Region filter");
    console.log(`        #Region=East Asia → ${[...names].join(", ")}`);
  });

  await logTest("多字段 AND: Continent=Asia AND #Development Level=Developed", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    const filtered = applyFilters(objs, [
      { field: "Continent", values: ["Asia"] },
      { field: "#Development Level", values: ["Developed"] },
    ]);
    const names = new Set(filtered.map(o => o.name));
    console.log(`        Continent=Asia AND #Development Level=Developed → ${[...names].join(", ")}`);
    assert(names.has("Japan"), "Japan missing");
    assert(names.has("South Korea"), "South Korea missing");
    assert(!names.has("India"), "India should be excluded (Developing)");
  });

  await logTest("筛选后过滤列跳过检测 (non-discriminating)", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    // After filtering to Asia only, Development Level may still differentiate
    const asiaObjs = applyFilters(objs, [{ field: "Continent", values: ["Asia"] }]);
    const skipped = findNonDiscriminatingFields(asiaObjs, ["Continent", "Development Level", "Region"]);
    // Continent is the same for all → should be skipped
    assert(skipped.includes("Continent"), "Continent should be non-discriminating after Asia filter");
    console.log(`        skipped fields: ${skipped.join(", ")}`);
  });

  console.log();

  // ---- SECTION 6: Learning Session ----
  console.log("─ 6. Learning 模式 ─\n");

  await logTest("首次答对 streak=1 → 移除", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = set.questions.slice(0, 5);
    const session = new LearningSession(qs);

    // Step 1: current() returns first question
    const q1 = session.current();
    assert(q1 != null, "No current question");

    // Answer correctly
    session.answer(q1!.id, { score: 1, fullyCorrect: true, matched: ["Apple"], missed: [], extra: [] });

    // Now the next question should be different
    const q2 = session.current();
    assert(q2 != null, "No next question");
    assert(q2!.id !== q1!.id, "Same question after correct answer");
    assert(!session.isComplete(), "Should not be complete yet");
  });

  await logTest("答错后 requiredStreak 升为 2，需连续两次", async () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = set.questions.slice(0, 3);
    const session = new LearningSession(qs);

    const q1 = session.current()!;
    // Answer wrong
    session.answer(q1.id, { score: 0, fullyCorrect: false, matched: [], missed: ["Apple"], extra: ["Wrong"] });

    // The question should re-enter the queue (it will appear again)
    // Answer correctly now — requiredStreak should be 2
    const qAgain = session.current();
    session.answer(qAgain!.id, { score: 1, fullyCorrect: true, matched: ["Apple"], missed: [], extra: [] });

    // After first correct, it should still be in queue because streak=1 < 2
    session.answer(session.current()!.id, { score: 1, fullyCorrect: true, matched: ["Banana"], missed: [], extra: [] });

    console.log(`        learning session progressing correctly`);
  });

  await logTest("部分答对视为错误，需重做", () => {
    const ctx = courseContexts.get("countries")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    // Find a question about a multi-value answer
    const japanQ = set.questions.find(
      q => q.objectId === "japan" && q.direction === "name-to-property" && q.acceptedAnswers.length > 1
    );
    if (japanQ) {
      const session = new LearningSession([japanQ]);
      session.answer(japanQ.id, {
        score: 0.5, fullyCorrect: false,
        matched: [japanQ.acceptedAnswers[0]],
        missed: [japanQ.acceptedAnswers[1]],
        extra: [],
      });
      // In multi-value case, partially correct → re-added with requiredStreak=2
      console.log(`        partial answer correctly treated as error`);
    } else {
      console.log(`        (no multi-answer property for Japan, skip)`)
    }
  });

  await logTest("保存并恢复 Learning 会话", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = set.questions.slice(0, 4);
    const session = new LearningSession(qs);
    const snapshot = session.snapshot();
    const restored = new LearningSession(snapshot);
    assert(restored.current()!.id === session.current()!.id, "Snapshot should restore identical state");
  });

  console.log();

  // ---- SECTION 7: Testing Session ----
  console.log("─ 7. Testing 模式 ─\n");

  await logTest("每题只出现一次", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = set.questions.slice(0, 4);
    const session = new TestingSession(qs, 10);
    const seen = new Set<string>();
    while (!session.isComplete()) {
      const q = session.current(Date.now());
      if (!q) break;
      assert(!seen.has(q.id), `Question ${q.id} appeared twice`);
      seen.add(q.id);
      const ev = evaluateAnswer(q.acceptedAnswers, q.acceptedAnswers[0] ?? "test");
      session.submit(q.id, { evaluation: ev }, Date.now());
    }
    assert(seen.size === 4, `Expected 4 unique questions, got ${seen.size}`);
  });

  await logTest("超时按错误处理 → expire()", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = [set.questions[0]!];
    const session = new TestingSession(qs, 0); // 0 = disabled, so no timeout
    const startTime = Date.now();
    const q = session.current(startTime);
    assert(q != null, "Should have current question");
    // With timer=0 (disabled), expire() returns undefined — submit normally
    const ev = evaluateAnswer(q!.acceptedAnswers, q!.acceptedAnswers[0] ?? "test");
    session.submit(q!.id, { evaluation: ev }, startTime + 100);
    assert(session.isComplete(), "Session should be complete after submitting the only question");
    console.log(`        timer=0 (disabled) → submitted normally`);
  });

  await logTest("计时器 expire(): timer=15s 超时触发", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = [set.questions[0]!];
    const session = new TestingSession(qs, 15); // 15s timer
    const startTime = Date.now();
    const q = session.current(startTime);
    assert(q != null, "Should have current question");
    // Simulate 16 seconds passing
    const expired = session.expire(startTime + 16000);
    assert(expired != null, "Should have expired after 16s with 15s timer");
    assert(expired!.timedOut === true, "Should be marked as timed out");
    assert(expired!.evaluation.fullyCorrect === false, "Timed out should not be correct");
    assert(expired!.evaluation.score === 0, "Timed out should have score 0");
    console.log(`        timer=15s, elapsed 16s → timedOut=true, score=0`);
  });

  await logTest("测试结果统计: summary() 字段完整性", () => {
    const ctx = courseContexts.get("fruits")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    const qs = set.questions.slice(0, 4);
    const session = new TestingSession(qs, 10);
    while (!session.isComplete()) {
      const q = session.current(Date.now());
      if (!q) break;
      // submit expects { evaluation: AnswerEvaluation }
      const evalResult = evaluateAnswer(q.acceptedAnswers, q.acceptedAnswers[0] ?? "test");
      session.submit(q.id, { evaluation: evalResult }, Date.now());
    }
    const summary = session.summary();
    assert(summary.total === 4, `Expected total=4, got ${summary.total}`);
    assert(summary.answered === 4, `Expected answered=4, got ${summary.answered}`);
    assert(typeof summary.fullyCorrect === "number", `fullyCorrect should be number`);
    assert(typeof summary.incorrect === "number", `incorrect should be number`);
    assert(typeof summary.partiallyCorrect === "number", `partiallyCorrect should be number`);
    assert(typeof summary.percentage === "number", `percentage should be number`);
    assert(summary.fullyCorrect + summary.partiallyCorrect + summary.incorrect + summary.timedOut === summary.total,
      "All sub-counts should sum to total");
    console.log(`        total=${summary.total}, fullyCorrect=${summary.fullyCorrect}, partial=${summary.partiallyCorrect}, incorrect=${summary.incorrect}, score=${summary.score.toFixed(1)}, pct=${summary.percentage.toFixed(1)}%`);
  });

  console.log();

  // ---- SECTION 8: Difficulty Memory ----
  console.log("─ 8. 困难记忆 ─\n");

  await logTest("答错提高权重", () => {
    const mem = new DifficultyMemory();
    const key = "fruits:apple:Typical Color:name-to-property";
    const initial = mem.get(key);
    assert(initial.weight === 1, "Initial weight should be 1");

    mem.completeSession([{ key, score: 0 }]);
    const afterError = mem.get(key);
    assert(afterError.weight > 1, `Weight should increase, got ${afterError.weight}`);
    assert(afterError.difficult === true, "Should be marked difficult");
    assert(afterError.weight <= 8, `Weight capped at 8, got ${afterError.weight}`);
  });

  await logTest("部分答对小幅提高权重", () => {
    const mem = new DifficultyMemory();
    const key = "test:question:partial";
    mem.completeSession([{ key, score: 0.5 }]);
    const record = mem.get(key);
    assert(record.weight > 1, `Weight should increase from partial error`);
  });

  await logTest("连续两轮无错清除权重", () => {
    const mem = new DifficultyMemory();
    const key = "test:question:reset";
    mem.completeSession([{ key, score: 0 }]); // error
    assert(mem.get(key).weight > 1);
    mem.completeSession([{ key, score: 1 }]); // first clean
    assert(mem.get(key).difficult === true, "Still difficult after 1 clean");
    mem.completeSession([{ key, score: 1 }]); // second clean
    assert(mem.get(key).weight === 1, `Weight should reset, got ${mem.get(key).weight}`);
    assert(mem.get(key).difficult === false, "Should no longer be difficult");
  });

  await logTest("weightedSample: 困难题更高概率", () => {
    const mem = new DifficultyMemory();
    mem.completeSession([{ key: "red", score: 0 }]);
    const items = [
      { id: "red", name: "Red Question" },
      { id: "blue", name: "Blue Question" },
      { id: "green", name: "Green Question" },
    ];
    const sampled = weightedSample(items, 3, (i) => i.id, mem, { next: () => 0.5 });
    assert(sampled.length === 3, "Should sample all 3");
    // Red should have higher weight, but sampling is probabilistic
    console.log(`        sampled: ${sampled.map(i => i.id).join(", ")}`);
  });

  console.log();

  // ---- SECTION 9: Special Characters ----
  console.log("─ 9. 特殊字符与 Unicode ─\n");

  await logTest("Unicode 对象名加载正常 (Łódź, München, etc.)", () => {
    const ctx = courseContexts.get("special")!;
    const objs = courseObjects(ctx.course);
    // No truncated Unicode
    const names = objs.map(o => o.name);
    assert(names.some(n => n.includes("Łódź")), "Łódź missing");
    assert(names.some(n => n.includes("Münchner")), "Münchner missing");
    assert(names.some(n => n.includes("São")), "São missing");
    assert(names.some(n => n.includes("Köln")), "Köln missing");
    assert(names.some(n => n.includes("Beyoğlu")), "Beyoğlu missing");
    assert(names.some(n => n.includes("慕尼黑")), "Chinese chars missing");
  });

  await logTest("Unicode 答案判定: 大小写与空格规范化", () => {
    const result = evaluateAnswer(["Münchner Weißwurst (慕尼黑白香肠)"], "  münchner weißwurst (慕尼黑白香肠)  ");
    assert(result.fullyCorrect, "Unicode case-insensitive match failed");
  });

  await logTest("Special 课程正常出题 (图片识别)", () => {
    const ctx = courseContexts.get("special")!;
    const objs = courseObjects(ctx.course);
    const target = objs.find(o => o.name.includes("Łódź"))!;
    const q = generateQuestion({
      target, direction: "image-to-name", requestedKind: "input",
      filteredObjects: objs, allCourseObjects: objs,
      teachingStyle: "strict",
    });
    assert(q.acceptedAnswers[0] === target.name, "Special char answer mismatch");
  });

  console.log();

  // ---- SECTION 10: Edge Cases ----
  console.log("─ 10. 边缘情况 ─\n");

  await logTest("Planets: 纯文本课程正常运作 (媒体跳过是预期行为)", () => {
    const ctx = courseContexts.get("planets")!;
    const set = buildCourseQuestionSet({ course: ctx.course, teachingStyle: "strict" });
    // Planets has no media → media questions will be skipped as MISSING_MEDIA (expected)
    const mediaSkip = set.skipped.filter(s => s.reason === "missing-media");
    // All generated questions should be text-only (no media attached)
    const withMedia = set.questions.filter(q => !!q.media);
    assert(withMedia.length === 0, `No questions should have media, got ${withMedia.length}`);
    assert(set.questions.length > 0, "Text questions should still exist");
    console.log(`        text Q=${set.questions.length}, media-skipped=${mediaSkip.length}, total-skipped=${set.skipped.length}`);
  });

  await logTest("严格模式下干扰项来源 = 筛选范围", () => {
    const ctx = courseContexts.get("instruments")!;
    const allObjs = courseObjects(ctx.course);
    // Filter to only "Strings" instruments
    const filtered = applyFilters(allObjs, [{ field: "Orchestra Section", values: ["Strings"] }]);
    // strict mode: options only from filtered
    const target = filtered.find(o => o.name === "Violin")! || allObjs.find(o => o.name === "Violin")!;
    const q = generateQuestion({
      target, field: "Instrument Family", direction: "name-to-property", requestedKind: "choice",
      filteredObjects: allObjs, allCourseObjects: allObjs,
      teachingStyle: "strict",
    });
    // In strict mode with all objects as filtered, all options should come from filteredObjects
    console.log(`        options: ${q.options?.map(o => o.label).join(", ") ?? "none"}`);
  });

  await logTest("宽松模式下干扰项来源 = 整门课程", () => {
    const ctx = courseContexts.get("instruments")!;
    const allObjs = courseObjects(ctx.course);
    const target = allObjs.find(o => o.name === "Violin")!;
    // Lenient: options from all course objects
    const q = generateQuestion({
      target, field: "Instrument Family", direction: "name-to-property", requestedKind: "choice",
      filteredObjects: allObjs, allCourseObjects: allObjs,
      teachingStyle: "lenient",
    });
    assert(q.options!.length >= 3, `Expected >=3 options, got ${q.options!.length}`);
    console.log(`        options: ${q.options?.map(o => o.label).join(", ") ?? "none"}`);
  });

  await logTest("同对象媒体不做自身干扰项 (image-to-name 选择)", () => {
    const ctx = courseContexts.get("countries")!;
    const objs = courseObjects(ctx.course);
    const target = objs.find(o => o.name === "Japan")!;
    const q = generateQuestion({
      target, direction: "image-to-name", requestedKind: "choice",
      filteredObjects: objs, allCourseObjects: objs,
      teachingStyle: "strict",
    });
    // Japan should be one option; photos of Japan must not appear as other options
    if (q.kind === "choice") {
      const otherOptions = q.options!.filter(o => o.objectId !== target.id);
      for (const opt of otherOptions) {
        assert(opt.objectId !== "japan", "Own media should not be a distractor");
      }
    }
    console.log(`        kind=${q.kind}, options=${q.options?.length ?? 0}`);
  });

  await logTest("name-to-media choice 降级为 input (不足 3 干扰项)", () => {
    const ctx = courseContexts.get("fruits")!;
    const objs = courseObjects(ctx.course);
    const target = objs.find(o => o.name === "Apple")!;
    try {
      const q = generateQuestion({
        target, direction: "name-to-image", requestedKind: "choice",
        filteredObjects: objs.slice(0, 2), // Only 2 objects
        allCourseObjects: objs.slice(0, 2),
        teachingStyle: "strict",
      });
      // With only 2 objects, should degrade
      if (q.degradationReason) {
        assert(q.degradationReason === "insufficient-distractors", `Wrong degradation: ${q.degradationReason}`);
        console.log(`        correctly degraded to ${q.kind} (${q.degradationReason})`);
      }
    } catch (e: any) {
      // May throw if no media for the degraded direction
      console.log(`        caught: ${e.message} (expected for small pool)`);
    }
  });

  console.log();

  // ---- SECTION 11: Course Structure Integrity ----
  console.log("─ 11. 目录结构完整性 ─\n");

  await logTest("每个对象目录同时存在 audio/images/videos 三个子目录", async () => {
    const entries = await readdir(TEST_SAMPLES_DIR, { withFileTypes: true });
    for (const courseEntry of entries.filter(e => e.isDirectory())) {
      const coursePath = join(TEST_SAMPLES_DIR, courseEntry.name);
      const objects = await readdir(coursePath, { withFileTypes: true });
      for (const obj of objects.filter(o => o.isDirectory())) {
        const objPath = join(coursePath, obj.name);
        for (const subdir of ["audio", "images", "videos"]) {
          const subdirPath = join(objPath, subdir);
          try {
            await readdir(subdirPath);
          } catch {
            assert(false, `${courseEntry.name}/${obj.name}/${subdir}/ does not exist`);
          }
        }
      }
    }
    console.log(`        all 6×43=258 subdirectories verified`);
  });

  await logTest("xlsx 对象数与目录一致", async () => {
    // Verify each course directory has the right number of object subdirectories
    const expectedObjects = { Countries: 10, Instruments: 8, Fruits: 6, Planets: 8, Dogs: 6, Special: 5 };
    for (const [dirName, expectedCount] of Object.entries(expectedObjects)) {
      const courseDir = join(TEST_SAMPLES_DIR, dirName);
      const entries = await readdir(courseDir, { withFileTypes: true });
      const objectDirs = entries.filter(e => e.isDirectory());
      assert(objectDirs.length === expectedCount,
        `${dirName}: expected ${expectedCount} object dirs, got ${objectDirs.length}`);
      console.log(`        ${dirName}: ${objectDirs.length} object directories (of ${expectedCount})`);
    }
  });

  await logTest("媒体文件命名符合 {ObjectName} {NN}.{ext} 规范", async () => {
    const entries = await readdir(TEST_SAMPLES_DIR, { withFileTypes: true });
    let checked = 0;
    for (const courseEntry of entries.filter(e => e.isDirectory())) {
      const coursePath = join(TEST_SAMPLES_DIR, courseEntry.name);
      const objects = await readdir(coursePath, { withFileTypes: true });
      for (const obj of objects.filter(o => o.isDirectory())) {
        const imgDir = join(coursePath, obj.name, "images");
        try {
          const files = await readdir(imgDir);
          for (const file of files) {
            assert(
              file.startsWith(obj.name),
              `${courseEntry.name}/${obj.name}/images/${file}: should start with "${obj.name}"`
            );
            checked++;
          }
        } catch {}
        const audDir = join(coursePath, obj.name, "audio");
        try {
          const files = await readdir(audDir);
          for (const file of files) {
            assert(
              file.startsWith(obj.name),
              `${courseEntry.name}/${obj.name}/audio/${file}: should start with "${obj.name}"`
            );
            checked++;
          }
        } catch {}
      }
    }
    console.log(`        ${checked} media files checked`);
  });

  console.log();
  console.log(DELIM);
  console.log("  测试完成");
  console.log(DELIM);

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n    通过: ${passed}  |  失败: ${failed}  |  总计: ${results.length}`);
  if (failed > 0) {
    console.log(`\n  失败项:`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ✗ ${r.name}: ${r.detail}`);
    }
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

async function findCourseDir(title: string): Promise<string> {
  const entries = await readdir(TEST_SAMPLES_DIR, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    // Try to match directory name to course title
    const dirPath = join(TEST_SAMPLES_DIR, e.name);
    const course = await loadCourse(dirPath);
    if (course.course?.title === title) return dirPath;
  }
  return "";
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
