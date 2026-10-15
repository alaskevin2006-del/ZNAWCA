import { readFile } from "node:fs/promises";
import type {
  WorksheetCell,
  WorksheetData,
} from "../../../core/course/types.js";
import { columnIndex } from "../../../core/course/normalization.js";
import { readZipEntries, ZipArchiveError } from "./zip-reader.js";
import {
  allTagContents,
  decodeXml,
  firstAttribute,
  textFromRichString,
} from "./xml.js";

export class XlsxReadError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly file: string,
  ) {
    super(message);
  }
}

export async function readFirstWorksheet(file: string): Promise<WorksheetData> {
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch (error) {
    throw new XlsxReadError(
      `Cannot read workbook: ${messageOf(error)}`,
      "WORKBOOK_UNREADABLE",
      file,
    );
  }

  try {
    const entries = readZipEntries(bytes);
    if (entries.has("EncryptionInfo") || entries.has("EncryptedPackage")) {
      throw new XlsxReadError(
        "Encrypted workbooks are not supported.",
        "WORKBOOK_ENCRYPTED",
        file,
      );
    }
    const workbook = requiredText(entries, "xl/workbook.xml");
    const sheetTag =
      /<(?:[\w.-]+:)?sheet\b[^>]*(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?sheet>)/iu.exec(
        workbook,
      )?.[0];
    if (!sheetTag)
      throw new XlsxReadError(
        "Workbook has no worksheet.",
        "WORKBOOK_EMPTY",
        file,
      );
    const sheetName = firstAttribute(sheetTag, "sheet", "name") ?? "Sheet1";
    const relationId = firstAttribute(sheetTag, "sheet", "r:id");
    const sheetPath = resolveSheetPath(entries, relationId);
    const sharedStrings = readSharedStrings(
      entries.get("xl/sharedStrings.xml"),
    );
    return {
      file,
      name: sheetName,
      cells: readCells(requiredText(entries, sheetPath), sharedStrings),
    };
  } catch (error) {
    if (error instanceof XlsxReadError) throw error;
    const detail =
      error instanceof ZipArchiveError ? error.message : messageOf(error);
    throw new XlsxReadError(
      `Workbook is damaged or unsupported: ${detail}`,
      "WORKBOOK_INVALID",
      file,
    );
  }
}

function resolveSheetPath(
  entries: ReadonlyMap<string, Buffer>,
  relationId?: string,
): string {
  if (!relationId) return "xl/worksheets/sheet1.xml";
  const relationships = requiredText(entries, "xl/_rels/workbook.xml.rels");
  for (const tag of relationships.match(
    /<(?:[\w.-]+:)?Relationship\b[^>]*\/>/giu,
  ) ?? []) {
    if (firstAttribute(tag, "Relationship", "Id") !== relationId) continue;
    const target = firstAttribute(tag, "Relationship", "Target");
    if (!target) break;
    return target.startsWith("/")
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//u, "")}`;
  }
  throw new XlsxReadError(
    "First worksheet relationship is missing.",
    "WORKBOOK_INVALID",
    "",
  );
}

function readSharedStrings(entry?: Buffer): readonly string[] {
  if (!entry) return [];
  return allTagContents(entry.toString("utf8"), "si").map(textFromRichString);
}

function readCells(
  xml: string,
  sharedStrings: readonly string[],
): readonly WorksheetCell[] {
  const cells: WorksheetCell[] = [];
  const cellPattern =
    /<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/giu;
  for (const match of xml.matchAll(cellPattern)) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    const reference = /\br="([^"]+)"/iu.exec(attributes)?.[1];
    if (!reference) continue;
    const row = Number.parseInt(/\d+$/u.exec(reference)?.[0] ?? "0", 10);
    const column = columnIndex(reference);
    const type = /\bt="([^"]+)"/iu.exec(attributes)?.[1];
    const raw = /<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/iu.exec(
      body,
    )?.[1];
    const formula = /<(?:[\w.-]+:)?f\b[^>]*>/iu.test(body);
    let value = raw === undefined ? "" : decodeXml(raw);
    if (type === "s" && raw !== undefined)
      value = sharedStrings[Number.parseInt(raw, 10)] ?? "";
    if (type === "inlineStr") value = textFromRichString(body);
    if (type === "b") value = value === "1" ? "TRUE" : "FALSE";
    cells.push({
      row,
      column,
      value,
      hasFormula: formula,
      formulaHasCachedValue: !formula || raw !== undefined,
    });
  }
  // 合并单元格只有左上角单元格在 XML 里带有值；其余被合并的单元格缺失或为空。
  // 若 A 列存在合并单元格（如 A2:A3），仅传播左上角值即可避免把这些行误判为 ITEM_NAME_EMPTY。
  return applyMergedCells(cells, parseMergeRanges(xml));
}

interface MergeRange {
  readonly row: number;
  readonly column: number;
  readonly endRow: number;
  readonly endColumn: number;
}

function parseCellReference(reference: string): {
  row: number;
  column: number;
} {
  const row = Number.parseInt(/\d+$/u.exec(reference)?.[0] ?? "0", 10);
  return { row, column: columnIndex(reference) };
}

function parseMergeRanges(xml: string): readonly MergeRange[] {
  const ranges: MergeRange[] = [];
  const pattern = /<(?:[\w.-]+:)?mergeCell\b([^>]*?)(?:\/>|>)/giu;
  for (const match of xml.matchAll(pattern)) {
    const ref = /\bref="([^"]+)"/iu.exec(match[1] ?? "")?.[1];
    if (!ref) continue;
    const [startRef, endRef] = ref.split(":");
    if (!startRef || !endRef) continue;
    const start = parseCellReference(startRef);
    const end = parseCellReference(endRef);
    if (start.row < 1 || start.column < 1 || end.row < 1 || end.column < 1)
      continue;
    ranges.push({
      row: start.row,
      column: start.column,
      endRow: end.row,
      endColumn: end.column,
    });
  }
  return ranges;
}

function applyMergedCells(
  cells: readonly WorksheetCell[],
  ranges: readonly MergeRange[],
): WorksheetCell[] {
  if (ranges.length === 0) return [...cells];
  const byKey = new Map(
    cells.map((cell) => [`${cell.row}:${cell.column}`, cell]),
  );
  for (const range of ranges) {
    // 仅处理纵向合并（单列跨行）：横向/二维合并不传播，避免污染其他列的数据。
    if (range.column !== range.endColumn) continue;
    const topLeft = byKey.get(`${range.row}:${range.column}`);
    const value = topLeft?.value ?? "";
    if (value.trim() === "") continue;
    for (let row = range.row; row <= range.endRow; row += 1) {
      if (row === range.row) continue;
      const key = `${row}:${range.column}`;
      const existing = byKey.get(key);
      if (existing && existing.value.trim() !== "") continue;
      byKey.set(key, {
        row,
        column: range.column,
        value,
        hasFormula: false,
        formulaHasCachedValue: true,
        merged: true,
      });
    }
  }
  return [...byKey.values()];
}

function requiredText(
  entries: ReadonlyMap<string, Buffer>,
  name: string,
): string {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Missing ${name}.`);
  return entry.toString("utf8");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
