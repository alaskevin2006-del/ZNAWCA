import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const rows = [
  ["Name", "Scientific name", "Diet", "#Group", "#Region"],
  ["Common Cuckoo", "Cuculus canorus", "insects; seeds; nuts", "Bird", "Europe"],
  ["Eurasian Skylark", "Alauda arvensis", "grain", "Bird", "Europe"],
  ["Great Tit", "Parus major", "beetles", "Bird", "Asia"],
  ["Common Blackbird", "Turdus merula", "worms", "Songbird", "Europe"],
];

export async function createCourseFixture(
  parent: string,
  directoryName = "Fixture",
  workbookName = "Fixture.xlsx",
  dataRows: readonly (readonly string[])[] = rows,
): Promise<{ directory: string; workbook: string }> {
  const directory = join(parent, directoryName);
  const workbook = join(directory, workbookName);
  await mkdir(directory, { recursive: true });
  await writeFile(workbook, createWorkbook(dataRows));
  return { directory, workbook };
}

// 回归用：含「有格式无值」的自闭合空 cell（<c r="D1" s="1"/>）紧邻有值的 A2，用于验证 readCells 不吞掉后续 cell。
export async function createSelfClosingCellFixture(parent: string): Promise<{ directory: string; workbook: string }> {
  const directory = join(parent, "SelfClosingCell");
  const workbook = join(directory, "SelfClosingCell.xlsx");
  await mkdir(directory, { recursive: true });
  const rowsXml =
    `<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Type?</t></is></c><c r="D1" s="1"/></row>` +
    `<row r="2"><c r="A2" t="inlineStr"><is><t>Granite</t></is></c><c r="B2" t="inlineStr"><is><t>Igneous</t></is></c></row>`;
  await writeFile(workbook, createStoredZip({
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="SelfClosingCell" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`,
  }));
  return { directory, workbook };
}

// 回归用：A 列存在合并单元格（A2:A3），A3 在 XML 中无 <c> 值，仅 B3 有值。
// 用于验证 readCells 把左上角 A2 的值传播到被合并的 A3，避免 ITEM_NAME_EMPTY 误报。
export async function createMergedCellFixture(parent: string): Promise<{ directory: string; workbook: string }> {
  const directory = join(parent, "MergedCell");
  const workbook = join(directory, "MergedCell.xlsx");
  await mkdir(directory, { recursive: true });
  const rowsXml =
    `<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Type</t></is></c></row>` +
    `<row r="2"><c r="A2" t="inlineStr"><is><t>Granite</t></is></c><c r="B2" t="inlineStr"><is><t>Igneous</t></is></c></row>` +
    `<row r="3"><c r="B3" t="inlineStr"><is><t>Sedimentary</t></is></c></row>` +
    `<row r="4"><c r="A4" t="inlineStr"><is><t>Basalt</t></is></c><c r="B4" t="inlineStr"><is><t>Volcanic</t></is></c></row>`;
  await writeFile(workbook, createStoredZip({
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="MergedCell" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData><mergeCells count="1"><mergeCell ref="A2:A3"/></mergeCells></worksheet>`,
  }));
  return { directory, workbook };
}

function createWorkbook(worksheetRows: readonly (readonly string[])[], sheetName = "Fixture"): Buffer {
  const rowsXml = worksheetRows.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((value, columnIndex) =>
      `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`,
    ).join("")}</row>`,
  ).join("");
  return createStoredZip({
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`,
  });
}

/** 覆写一个已存在（或新建）的工作簿，用于构造异常场景。 */
export async function writeWorkbookRows(
  workbookPath: string,
  worksheetRows: readonly (readonly string[])[],
  sheetName = "Fixture",
): Promise<void> {
  await writeFile(workbookPath, createWorkbook(worksheetRows, sheetName));
}

// ---- V2 最小多语言样例（D-15~D-18）----

export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
export const MP3_BYTES = Buffer.from("ID3", "utf8");

const v2EngRows = [
  ["Birds of Europe", "Name / Bird", "Diet / Food"],
  ["cuckoo.jpg", "Common Cuckoo", "insects"],
  ["sparrow.png/sparrow-flying.jpg", "House Sparrow", "seeds"],
  ["gull.jpg", "European Herring Gull", "fish"],
];

const v2RuRows = [
  ["Птицы Европы", "Название / Птица", "Питание / Еда"],
  ["cuckoo.jpg", "Обыкновенная кукушка", "насекомые"],
  ["sparrow.png/sparrow-flying.jpg", "Домовый воробей", "семена"],
  ["gull.jpg", "Серебристая чайка", "рыба"],
];

/**
 * 最小多语言 V2 课程样例：`Birds/` 目录含 `Birds_Eng.xlsx`、`Birds_Ru.xlsx`（按基础名+语言后缀分组），
 * 共享 `media/` 放内容媒体（两种语言引用同一张 `cuckoo.jpg`；`sparrow` 用 `/` 分隔两个图片变体），
 * `speech/Eng/`、`speech/Ru/` 为分语言朗读目录。
 */
export async function createMultilingualCourseFixture(parent: string): Promise<{
  directory: string;
  mediaDirectory: string;
  engWorkbook: string;
  ruWorkbook: string;
}> {
  const directory = join(parent, "Birds");
  const mediaDirectory = join(directory, "media");
  await mkdir(mediaDirectory, { recursive: true });
  const engWorkbook = join(directory, "Birds_Eng.xlsx");
  const ruWorkbook = join(directory, "Birds_Ru.xlsx");
  await writeFile(engWorkbook, createWorkbook(v2EngRows, "Birds"));
  await writeFile(ruWorkbook, createWorkbook(v2RuRows, "Birds"));
  const sharedMedia: Record<string, Buffer> = {
    "cuckoo.jpg": JPEG_BYTES,
    "sparrow.png": PNG_BYTES,
    "sparrow-flying.jpg": JPEG_BYTES,
    "gull.jpg": JPEG_BYTES,
  };
  for (const [name, bytes] of Object.entries(sharedMedia)) {
    await writeFile(join(mediaDirectory, name), bytes);
  }
  await mkdir(join(directory, "speech", "Eng"), { recursive: true });
  await mkdir(join(directory, "speech", "Ru"), { recursive: true });
  await writeFile(join(directory, "speech", "Eng", "B2.mp3"), MP3_BYTES);
  await writeFile(join(directory, "speech", "Ru", "B2.mp3"), MP3_BYTES);
  return { directory, mediaDirectory, engWorkbook, ruWorkbook };
}

function createStoredZip(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function columnName(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
