import type { Course } from "../../core/course/types";
import type { Question, QuestionOption } from "../../core/quiz/types";

/**
 * D-22：单元格朗读音频的坐标解析。
 *
 * 朗读文件按坐标命名放在当前工作簿语言的 `speech/<lang>/` 目录：
 * - 普通单元格 `<列字母><行号>.mp3`（如 `C4.mp3`）；
 * - 双向列标题 `<列字母>1-F.mp3`（正向题干）/ `<列字母>1-R.mp3`（反向题干）；
 * - 名称列 V1＝A 列、V2＝B 列（`course.nameColumnIndex`）。
 *
 * 没有对应文件时静默跳过（返回值中不含该项）；绝不启用 TTS。
 * 所有查找都是纯函数，便于自动测试复现。
 */

/** 列号 → Excel 列字母（1→A、2→B、27→AA）。 */
export function columnLetters(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function speechIndex(course: Course): Map<string, string> {
  const index = new Map<string, string>();
  for (const asset of course.speech ?? []) {
    const dot = asset.file.lastIndexOf(".");
    index.set(dot > 0 ? asset.file.slice(0, dot) : asset.file, asset.url);
  }
  return index;
}

function objectRow(course: Course, objectId: string): number | undefined {
  return course.items.find((item) => item.id === objectId)?.sourceRow;
}

function fieldColumnIndex(course: Course, field: string): number | undefined {
  return course.columns.find((column) => column.title === field)?.index;
}

interface CellCoordinate {
  readonly column: number;
  readonly row: number;
}

/**
 * 文字题的「问题单元格」：题目向学习者呈现的那一格。
 * - 正向（name-to-property、name-to-media）：呈现名称 → 名称列单元格；
 * - 反向（property-to-name）：呈现属性值 → 该属性列单元格；
 * - 题目本身是媒体（question.media 存在，即 image/audio/video-to-name）：不朗读。
 */
function questionCellCoordinate(course: Course, question: Question): CellCoordinate | undefined {
  if (question.media) return undefined;
  const row = objectRow(course, question.objectId);
  if (row === undefined) return undefined;
  if (question.direction === "property-to-name") {
    const column = question.field ? fieldColumnIndex(course, question.field) : undefined;
    return column === undefined ? undefined : { column, row };
  }
  return { column: course.nameColumnIndex ?? 1, row };
}

/**
 * D-22/D-23：一道文字题出现时按界面显示顺序要播放的朗读片段。
 * 界面提示语为「内容 / 题干」，因此顺序是：问题单元格音频 → 该方向的双向标题音频
 * （正向 `C1-F.mp3`、反向 `C1-R.mp3`）。任何缺失的片段都被静默跳过。
 */
export function speechAudioForQuestion(course: Course, question: Question): string[] {
  const index = speechIndex(course);
  if (index.size === 0) return [];
  const urls: string[] = [];
  const cell = questionCellCoordinate(course, question);
  if (cell) {
    const cellUrl = index.get(`${columnLetters(cell.column)}${cell.row}`);
    if (cellUrl) urls.push(cellUrl);
    if (question.field) {
      const column = fieldColumnIndex(course, question.field);
      if (column !== undefined) {
        const suffix = question.direction === "property-to-name" ? "R" : "F";
        const stemUrl = index.get(`${columnLetters(column)}1-${suffix}`);
        if (stemUrl) urls.push(stemUrl);
      }
    }
  }
  return urls;
}

/**
 * D-22：文字答案按钮的朗读音频（手动扬声器触发）。
 * - 正向题的选项是属性值 → 该对象在属性列的单元格；
 * - 反向题的选项是名称 → 该对象的名称列单元格；
 * 媒体选项自带播放控件，不提供朗读。
 */
export function speechAudioForOption(course: Course, question: Question, option: QuestionOption): string | undefined {
  if (option.media) return undefined;
  const index = speechIndex(course);
  if (index.size === 0) return undefined;
  const row = objectRow(course, option.objectId);
  if (row === undefined) return undefined;
  const column = question.direction === "property-to-name"
    ? course.nameColumnIndex ?? 1
    : question.field ? fieldColumnIndex(course, question.field) : undefined;
  if (column === undefined) return undefined;
  return index.get(`${columnLetters(column)}${row}`);
}
