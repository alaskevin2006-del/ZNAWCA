import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { scanFeedbackSounds, selectFeedbackSound } from "../../src/main/course/feedback-sounds.js";
import type { RandomSource } from "../../src/core/quiz/types.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function createSoundDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "znawca-feedback-"));
  temporary.push(root);
  return root;
}

// 固定随机源：按序返回给定值（与 Math.random 相同的 [0,1) 区间语义），耗尽后停在最后一个。
function source(values: number[]): RandomSource {
  let index = 0;
  return { next: () => values[Math.min(index++, values.length - 1)] };
}

describe("course feedback sound scanning", () => {
  it("recognizes strictly named mp3 files in the course root", async () => {
    const root = await createSoundDirectory();
    await writeFile(join(root, "correct 00.mp3"), "mock");
    await writeFile(join(root, "correct 12.mp3"), "mock");
    await writeFile(join(root, "incorrect 99.mp3"), "mock");
    const result = await scanFeedbackSounds(root);
    expect(result.correct).toEqual([join(root, "correct 00.mp3"), join(root, "correct 12.mp3")]);
    expect(result.incorrect).toEqual([join(root, "incorrect 99.mp3")]);
  });

  it("ignores wrong prefixes, digit counts, extensions and subdirectory files", async () => {
    const root = await createSoundDirectory();
    await mkdir(join(root, "sounds"), { recursive: true });
    await writeFile(join(root, "sounds", "correct 00.mp3"), "mock"); // 子目录不识别
    await writeFile(join(root, "Correct 00.mp3"), "mock"); // 大小写前缀不识别
    await writeFile(join(root, "correct_00.mp3"), "mock"); // 下划线不识别
    await writeFile(join(root, "correct 0.mp3"), "mock"); // 一位数字不识别
    await writeFile(join(root, "correct 000.mp3"), "mock"); // 三位数字不识别
    await writeFile(join(root, "correct 00.wav"), "mock"); // 扩展名不识别
    await writeFile(join(root, "incorrect 00.mp4"), "mock"); // 扩展名不识别
    await writeFile(join(root, "wrong 00.mp3"), "mock"); // 前缀不识别
    const result = await scanFeedbackSounds(root);
    expect(result.correct).toEqual([]);
    expect(result.incorrect).toEqual([]);
  });

  it("recognizes non-consecutive numbers and returns them sorted", async () => {
    const root = await createSoundDirectory();
    await writeFile(join(root, "incorrect 05.mp3"), "mock");
    await writeFile(join(root, "incorrect 01.mp3"), "mock");
    await writeFile(join(root, "correct 42.mp3"), "mock");
    await writeFile(join(root, "correct 07.mp3"), "mock");
    const result = await scanFeedbackSounds(root);
    expect(result.correct).toEqual([join(root, "correct 07.mp3"), join(root, "correct 42.mp3")]);
    expect(result.incorrect).toEqual([join(root, "incorrect 01.mp3"), join(root, "incorrect 05.mp3")]);
  });

  it("returns empty sets when nothing matches and never blocks", async () => {
    const root = await createSoundDirectory();
    await writeFile(join(root, "note.txt"), "mock");
    const result = await scanFeedbackSounds(root);
    expect(result.correct).toEqual([]);
    expect(result.incorrect).toEqual([]);
  });
});

describe("feedback sound selection", () => {
  it("is reproducible with a fixed random source", () => {
    const candidates = ["a", "b", "c", "d"];
    const first = selectFeedbackSound(candidates, source([0.5]), -1);
    const second = selectFeedbackSound(candidates, source([0.5]), -1);
    expect(first).toBe(2);
    expect(second).toBe(2);
  });

  it("avoids repeating the previous candidate when several exist", () => {
    const candidates = ["a", "b", "c", "d"];
    // random 选中 3（与 previous 相同）→ 强制推进到下一个（0）
    expect(selectFeedbackSound(candidates, source([0.75]), 3)).toBe(0);
    // random 选中 1，previous 为 0 → 直接返回 1
    expect(selectFeedbackSound(candidates, source([0.25]), 0)).toBe(1);
  });

  it("repeats the only candidate and returns -1 for an empty set", () => {
    expect(selectFeedbackSound(["only"], source([0, 0, 0]), 0)).toBe(0);
    expect(selectFeedbackSound([], source([0]), -1)).toBe(-1);
    expect(selectFeedbackSound([], source([0]), 3)).toBe(-1);
  });
});
