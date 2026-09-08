import { basename, extname } from "node:path";
import { columnLetters, normalizeKey, normalizeWhitespace, splitValues } from "./normalization.js";
import type {
  Course,
  CourseColumn,
  CourseIssue,
  CourseItem,
  MediaAsset,
  WorksheetCell,
  WorksheetData,
} from "./types.js";

export interface ValidatedWorksheet {
  readonly course?: Course;
  readonly issues: readonly CourseIssue[];
}

export function validateWorksheet(
  worksheet: WorksheetData,
  courseDirectory: string,
  workbookPath: string,
  media: ReadonlyMap<string, readonly MediaAsset[]> = new Map(),
): ValidatedWorksheet {
  const issues: CourseIssue[] = [];
  const cells = indexCells(worksheet.cells);
  const maxColumn = Math.max(0, ...worksheet.cells.map((cell) => cell.column));
  const maxRow = Math.max(0, ...worksheet.cells.map((cell) => cell.row));
  if (maxRow === 0 || maxColumn === 0) {
    issues.push(issue("error", "WORKBOOK_EMPTY", "Workbook has no usable cells.", "Add a header row and at least one item.", worksheet.file));
    return { issues };
  }

  const columns: CourseColumn[] = [];
  const seenHeaders = new Map<string, number>();
  for (let column = 1; column <= maxColumn; column += 1) {
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

  if (!columns.some((column) => column.index === 1)) {
    issues.push(issue("error", "NAME_HEADER_MISSING", "The first column must identify the item name.", "Add a title to cell A1.", worksheet.file, worksheet.name, 1, 1));
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
    const nameCell = cells.get(key(row, 1));
    const name = normalizeWhitespace(nameCell?.value ?? "");
    if (!name) {
      if (nameCell?.hasFormula && !nameCell.formulaHasCachedValue) continue;
      const filledColumns = rowCells
        .filter((cell) => cell.column !== 1 && normalizeWhitespace(cell.value) !== "")
        .map((cell) => columnLetters(cell.column));
      issues.push({
        severity: "error",
        code: "ITEM_NAME_EMPTY",
        message: `Row ${row} column A (item name) is empty.`,
        suggestion: filledColumns.length > 0
          ? `Column ${filledColumns.join(", ")} has content but column A is empty. Fill column A in row ${row} or delete this row.`
          : `Fill column A in row ${row} or delete this row.`,
        location: { file: worksheet.file, sheet: worksheet.name, row, column: 1 },
        params: { filledColumns },
      });
      continue;
    }
    const id = normalizeKey(name);
    const existingIndex = seenNames.get(id);
    const isMergedContinuation = existingIndex !== undefined && nameCell?.merged === true;
    if (existingIndex !== undefined && !isMergedContinuation) {
      issues.push(issue("error", "ITEM_NAME_DUPLICATE", `Item name '${name}' is duplicated.`, `Rename this item; it duplicates row ${existingIndex}.`, worksheet.file, worksheet.name, row, 1, columns[0]?.title));
      continue;
    }
    const rowValues: Record<string, readonly string[]> = {};
    for (const column of columns.slice(1)) {
      const raw = cells.get(key(row, column.index))?.value ?? "";
      rowValues[column.title] = splitValues(raw);
    }
    if (isMergedContinuation) {
      // 合并单元格续行：属性并入同名 item，不另建 item、不报 ANSWER_EMPTY（续行某列留空属正常）。
      const existing = items[existingIndex!];
      const mergedValues: Record<string, readonly string[]> = { ...existing.values };
      for (const [title, parts] of Object.entries(rowValues)) {
        if (parts.length > 0) mergedValues[title] = [...(existing.values[title] ?? []), ...parts];
      }
      items[existingIndex!] = { ...existing, values: mergedValues };
      continue;
    }
    seenNames.set(id, items.length);
    for (const column of columns.slice(1)) {
      const parts = rowValues[column.title] ?? [];
      if (!column.filterOnly && parts.length === 0) {
        issues.push(issue("warning", "ANSWER_EMPTY", `Answer is empty for '${column.title}'.`, "Fill the answer or exclude this question column.", worksheet.file, worksheet.name, row, column.index, column.title));
      }
    }
    items.push({ id, name, sourceRow: row, values: rowValues, media: media.get(id) ?? [] });
  }

  if (items.length === 0) {
    issues.push(issue("error", "NO_VALID_ITEMS", "Workbook contains no valid items.", "Add at least one named item below the header.", worksheet.file, worksheet.name));
  }
  if (columns.filter((column) => column.index > 1 && !column.filterOnly).length === 0 && [...media.values()].every((assets) => assets.length === 0)) {
    issues.push(issue("error", "NO_LEARNING_CONTENT", "Course has no question columns or media.", "Add a normal question column or supported media.", worksheet.file, worksheet.name));
  }
  if (issues.some((entry) => entry.severity === "error")) return { issues };

  const title = basename(workbookPath, extname(workbookPath));
  return {
    course: {
      id: normalizeKey(title),
      title,
      // V1 只读兼容：名称在 A 列、整行媒体按目录扫描；格式版本显式标识，不靠猜测切换。
      formatVersion: "v1",
      nameColumnIndex: 1,
      directory: courseDirectory,
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
