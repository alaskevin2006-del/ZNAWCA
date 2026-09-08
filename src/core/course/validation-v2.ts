import { basename, extname } from "node:path";
import { normalizeKey, normalizeWhitespace, splitValues } from "./normalization.js";
import { scanCellMedia } from "./cell-media.js";
import type {
  Course,
  CourseColumn,
  CourseIssue,
  CourseItem,
  MediaAsset,
  WorksheetCell,
  WorksheetData,
} from "./types.js";

export interface ValidatedV2Worksheet {
  readonly course?: Course;
  readonly issues: readonly CourseIssue[];
}

/**
 * V2 工作簿结构（D-15）：
 * - `A1` ＝ 当前语言课程显示名（非列标题）
 * - `A2+` ＝ 该行主媒体引用（解析为 item.media）
 * - `B1` ＝ 名称列双向题干（列标题），`B2+` ＝ 名称/别名
 * - `C1+` ＝ 属性列双向题干（列标题），`C2+` ＝ 文本答案或属性媒体引用
 *
 * 归一化到 Course：名称列 index=2，属性列 index>=3，`nameColumnIndex=2`，
 * `displayTitle` 取 A1，`id` 沿用「基础名_语言」以隔离学习记录。
 * 媒体引用经 `scanCellMedia` 解析（D-17/D-18）。
 */
export async function validateV2Worksheet(
  worksheet: WorksheetData,
  courseDirectory: string,
  workbookPath: string,
  language: { readonly base: string; readonly language: string },
): Promise<ValidatedV2Worksheet> {
  const issues: CourseIssue[] = [];
  const cells = indexCells(worksheet.cells);
  const maxColumn = Math.max(0, ...worksheet.cells.map((cell) => cell.column));
  const maxRow = Math.max(0, ...worksheet.cells.map((cell) => cell.row));
  if (maxRow === 0 || maxColumn < 2) {
    issues.push(issue("error", "WORKBOOK_EMPTY", "Workbook has no usable cells.", "Add a header row and at least one item.", worksheet.file));
    return { issues };
  }

  const { resolve, issues: mediaIssues } = await scanCellMedia(courseDirectory);
  issues.push(...mediaIssues);

  const displayTitle = normalizeWhitespace(cells.get(key(1, 1))?.value ?? "");

  // 名称列固定为 B（index=2）；属性列从 C（index=3）起。
  const nameColumnIndex = 2;
  const columns: CourseColumn[] = [];
  const seenHeaders = new Map<string, number>();
  const nameHeader = normalizeWhitespace(cells.get(key(1, nameColumnIndex))?.value ?? "");
  if (!nameHeader) {
    issues.push(issue("error", "NAME_HEADER_MISSING", "The name column header (B1) is empty.", "Add a title to cell B1.", worksheet.file, worksheet.name, 1, nameColumnIndex));
  } else {
    seenHeaders.set(normalizeKey(nameHeader), nameColumnIndex);
    columns.push({ index: nameColumnIndex, title: nameHeader, displayTitle: nameHeader, filterOnly: false });
  }
  for (let column = nameColumnIndex + 1; column <= maxColumn; column += 1) {
    const title = normalizeWhitespace(cells.get(key(1, column))?.value ?? "");
    if (!title) {
      issues.push(issue("error", "HEADER_EMPTY", "Column header is empty.", "Fill the header or remove the column.", worksheet.file, worksheet.name, 1, column));
      continue;
    }
    const normalized = normalizeKey(title);
    const duplicate = seenHeaders.get(normalized);
    if (duplicate !== undefined) {
      issues.push(issue("error", "HEADER_DUPLICATE", `Column header '${title}' is duplicated.`, `Rename column ${column}; it duplicates column ${duplicate}.`, worksheet.file, worksheet.name, 1, column, title));
    } else {
      seenHeaders.set(normalized, column);
    }
    const filterOnly = title.startsWith("#");
    columns.push({ index: column, title, displayTitle: filterOnly ? title.slice(1).trim() : title, filterOnly });
  }

  const items: CourseItem[] = [];
  const seenNames = new Map<string, number>();
  for (let row = 2; row <= maxRow; row += 1) {
    const rowCells = worksheet.cells.filter((cell) => cell.row === row);
    if (rowCells.every((cell) => normalizeWhitespace(cell.value) === "")) continue;
    for (const cell of rowCells) {
      if (cell.hasFormula && !cell.formulaHasCachedValue) {
        issues.push(issue("error", "FORMULA_VALUE_MISSING", "Formula has no cached value.", "Open and save the workbook in Excel before importing.", worksheet.file, worksheet.name, row, cell.column));
      }
    }
    const nameCell = cells.get(key(row, nameColumnIndex));
    const name = normalizeWhitespace(nameCell?.value ?? "");
    if (!name) {
      const filledColumns = rowCells
        .filter((cell) => cell.column !== nameColumnIndex && normalizeWhitespace(cell.value) !== "")
        .map((cell) => columnLetters(cell.column));
      issues.push({
        severity: "error",
        code: "ITEM_NAME_EMPTY",
        message: `Row ${row} column B (item name) is empty.`,
        suggestion: filledColumns.length > 0
          ? `Column ${filledColumns.join(", ")} has content but column B is empty. Fill column B in row ${row} or delete this row.`
          : `Fill column B in row ${row} or delete this row.`,
        location: { file: worksheet.file, sheet: worksheet.name, row, column: nameColumnIndex },
        params: { filledColumns },
      });
      continue;
    }
    const id = normalizeKey(name);
    const existingIndex = seenNames.get(id);
    if (existingIndex !== undefined) {
      issues.push(issue("error", "ITEM_NAME_DUPLICATE", `Item name '${name}' is duplicated.`, `Rename this item; it duplicates row ${existingIndex}.`, worksheet.file, worksheet.name, row, nameColumnIndex, columns.find((column) => column.index === nameColumnIndex)?.title));
      continue;
    }
    seenNames.set(id, items.length);

    // A 列（index=1）＝ 主媒体引用。
    const mainMedia = await resolve(cells.get(key(row, 1))?.value ?? "", worksheet.name, row, 1);

    const rowValues: Record<string, readonly string[]> = {};
    const cellMedia: Record<string, readonly MediaAsset[]> = {};
    for (const column of columns.filter((entry) => entry.index > nameColumnIndex)) {
      const raw = cells.get(key(row, column.index))?.value ?? "";
      const media = await resolve(raw, worksheet.name, row, column.index, column.title);
      if (media.length > 0) {
        // 该单元格是媒体引用（D-17）：属性单元格媒体只表达该属性，不进入文本答案。
        cellMedia[column.title] = media;
        rowValues[column.title] = [];
      } else {
        rowValues[column.title] = splitValues(raw);
      }
    }
    for (const column of columns.filter((entry) => entry.index > nameColumnIndex && !entry.filterOnly)) {
      const hasAnswer = (rowValues[column.title] ?? []).length > 0 || (cellMedia[column.title] ?? []).length > 0;
      if (!hasAnswer) {
        issues.push(issue("warning", "ANSWER_EMPTY", `Answer is empty for '${column.title}'.`, "Fill the answer or exclude this question column.", worksheet.file, worksheet.name, row, column.index, column.title));
      }
    }
    items.push({
      id,
      name,
      sourceRow: row,
      values: rowValues,
      media: mainMedia,
      cellMedia: Object.keys(cellMedia).length > 0 ? cellMedia : undefined,
    });
  }

  // D-18：同一属性列的单元格须统一为文字或同一种媒体类别，混合时精确报错。
  for (const column of columns.filter((entry) => entry.index > nameColumnIndex)) {
    const mediaKinds = new Set<string>();
    let hasText = false;
    for (const item of items) {
      const cellAssets = item.cellMedia?.[column.title] ?? [];
      if (cellAssets.length > 0) {
        for (const asset of cellAssets) mediaKinds.add(asset.kind);
      } else if ((item.values[column.title] ?? []).length > 0) {
        hasText = true;
      }
    }
    if (mediaKinds.size > 1 || (mediaKinds.size > 0 && hasText)) {
      issues.push(issue("error", "COLUMN_MEDIA_MIXED_KIND", `Column '${column.title}' mixes media kinds or media with text.`, "Keep each column a single media kind, or text only.", worksheet.file, worksheet.name, 1, column.index, column.title));
    }
  }

  if (items.length === 0) {
    issues.push(issue("error", "NO_VALID_ITEMS", "Workbook contains no valid items.", "Add at least one named item below the header.", worksheet.file, worksheet.name));
  }
  if (columns.filter((column) => column.index > nameColumnIndex && !column.filterOnly).length === 0) {
    issues.push(issue("error", "NO_LEARNING_CONTENT", "Course has no question columns.", "Add a normal question column.", worksheet.file, worksheet.name));
  }
  if (issues.some((entry) => entry.severity === "error")) return { issues };

  const id = normalizeKey(`${language.base}_${language.language}`);
  const title = displayTitle || language.base;
  return {
    course: {
      id,
      title,
      displayTitle: displayTitle || undefined,
      languageCode: language.language,
      formatVersion: "v2",
      nameColumnIndex,
      directory: dirnameOf(workbookPath),
      workbookPath,
      sheetName: worksheet.name,
      columns,
      items,
    },
    issues,
  };
}

function indexCells(cells: readonly WorksheetCell[]): Map<string, WorksheetCell> {
  return new Map(cells.map((cell) => [key(cell.row, cell.column), cell]));
}

function key(row: number, column: number): string {
  return `${row}:${column}`;
}

function dirnameOf(filePath: string): string {
  return filePath.slice(0, Math.max(0, filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")));
}

function columnLetters(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function issue(
  severity: "error" | "warning",
  code: string,
  message: string,
  suggestion: string,
  file: string,
  sheet?: string,
  row?: number,
  column?: number,
  columnName?: string,
): CourseIssue {
  return { severity, code, message, suggestion, location: { file, sheet, row, column, columnName } };
}
