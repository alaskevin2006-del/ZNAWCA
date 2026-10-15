import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { FEEDBACK_SOUND_PATTERN } from "../../core/course/feedback-sound-select.js";

export interface FeedbackSoundSet {
  readonly correct: readonly string[];
  readonly incorrect: readonly string[];
}

// D-12：只扫描课程根目录中严格命名 `correct NN.mp3` / `incorrect NN.mp3` 的文件，
// NN 为两位数字（00–99，可不连续）。错误前缀、位数、扩展名以及子目录中的
// 同名文件均不识别；目录不可读或没有匹配文件时返回空集合，不产生问题、不阻断。

export async function scanFeedbackSounds(
  courseDirectory: string,
): Promise<FeedbackSoundSet> {
  let entries;
  try {
    entries = await readdir(courseDirectory, { withFileTypes: true });
  } catch {
    return { correct: [], incorrect: [] };
  }
  const correct: string[] = [];
  const incorrect: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = FEEDBACK_SOUND_PATTERN.exec(entry.name);
    if (!match) continue;
    const filePath = join(courseDirectory, entry.name);
    if (match[1] === "correct") correct.push(filePath);
    else incorrect.push(filePath);
  }
  correct.sort();
  incorrect.sort();
  return { correct, incorrect };
}

// 纯函数选择逻辑拆到 feedback-sound-select.ts（无 Node 依赖），
// 此处仅 re-export 以保持既有调用方（如测试）的 import 路径不变。
export { selectFeedbackSound } from "../../core/course/feedback-sound-select.js";
