import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateV2Worksheet } from "../../src/core/course/validation-v2.js";
import type { WorksheetData } from "../../src/core/course/types.js";

function worksheet(cells: WorksheetData["cells"]): WorksheetData {
  return { file: "Birds_Eng.xlsx", name: "Birds", cells };
}

const language = { base: "Birds", language: "Eng" };
const dir = "C:/Birds";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const MP3 = Buffer.from("ID3", "utf8");

function cell(row: number, column: number, value: string): WorksheetData["cells"][number] {
  return { row, column, value, hasFormula: false, formulaHasCachedValue: true };
}

describe("V2 worksheet validation", () => {
  it("parses the neutral A column, name in B, and attributes from C onward", async () => {
    const result = await validateV2Worksheet(worksheet([
      { row: 1, column: 1, value: "Birds of Europe", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 3, value: "Diet", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 4, value: "#Group", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "Common Cuckoo", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 3, value: "insects; seeds", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 4, value: "Bird", hasFormula: false, formulaHasCachedValue: true },
    ]), dir, "C:/Birds/Birds_Eng.xlsx", language);

    expect(result.issues).toEqual([]);
    expect(result.course).toMatchObject({
      id: "birds_eng",
      title: "Birds of Europe",
      displayTitle: "Birds of Europe",
      languageCode: "Eng",
      formatVersion: "v2",
      nameColumnIndex: 2,
    });
    expect(result.course?.items).toHaveLength(1);
    expect(result.course?.items[0]).toMatchObject({ name: "Common Cuckoo", values: { Diet: ["insects", "seeds"] } });
    expect(result.course?.columns.find((column) => column.index === 4)).toMatchObject({ filterOnly: true });
  });

  it("reports ITEM_NAME_EMPTY against column B", async () => {
    const result = await validateV2Worksheet(worksheet([
      { row: 1, column: 1, value: "Birds", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 3, value: "Diet", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 3, value: "insects", hasFormula: false, formulaHasCachedValue: true },
    ]), dir, "C:/Birds/Birds_Eng.xlsx", language);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "ITEM_NAME_EMPTY",
      location: expect.objectContaining({ column: 2 }),
      params: expect.objectContaining({ filledColumns: ["C"] }),
    }));
  });

  it("falls back to the base name when A1 is empty", async () => {
    const result = await validateV2Worksheet(worksheet([
      { row: 1, column: 2, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 3, value: "Diet", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "Gull", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 3, value: "fish", hasFormula: false, formulaHasCachedValue: true },
    ]), dir, "C:/Birds/Birds_Eng.xlsx", language);
    expect(result.course?.title).toBe("Birds");
    expect(result.course?.displayTitle).toBeUndefined();
  });

  it("uses distinct ids per language for the same base", async () => {
    const eng = await validateV2Worksheet(worksheet([
      { row: 1, column: 1, value: "Birds", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 3, value: "Diet", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "Gull", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 3, value: "fish", hasFormula: false, formulaHasCachedValue: true },
    ]), dir, "C:/Birds/Birds_Eng.xlsx", { base: "Birds", language: "Eng" });
    const ru = await validateV2Worksheet(worksheet([
      { row: 1, column: 1, value: "Птицы", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 3, value: "Diet", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "Gull", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 3, value: "fish", hasFormula: false, formulaHasCachedValue: true },
    ]), dir, "C:/Birds/Birds_Ru.xlsx", { base: "Birds", language: "Ru" });
    expect(eng.course?.id).toBe("birds_eng");
    expect(ru.course?.id).toBe("birds_ru");
    expect(eng.course?.displayTitle).toBe("Birds");
    expect(ru.course?.displayTitle).toBe("Птицы");
  });
});

describe("V2 cell media column consistency (D-18)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-v2media-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function withMedia(files: Record<string, Buffer>) {
    const mediaDir = join(root, "media");
    await mkdir(mediaDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(mediaDir, name), content);
    }
  }

  async function validate(cells: WorksheetData["cells"]) {
    return validateV2Worksheet(worksheet(cells), root, join(root, "Birds_Eng.xlsx"), language);
  }

  it("accepts a column whose media cells share one kind and stores cellMedia", async () => {
    await withMedia({ "cuckoo.jpg": JPEG, "gull.jpg": JPEG });
    const result = await validate([
      cell(1, 1, "Birds"), cell(1, 2, "Name"), cell(1, 3, "Song"),
      cell(2, 2, "Cuckoo"), cell(2, 3, "cuckoo.jpg"),
      cell(3, 2, "Gull"), cell(3, 3, "gull.jpg"),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.course?.items[0].cellMedia?.["Song"]).toHaveLength(1);
    expect(result.course?.items[1].cellMedia?.["Song"]).toHaveLength(1);
  });

  it("reports COLUMN_MEDIA_MIXED_KIND when a column mixes media kinds across rows", async () => {
    await withMedia({ "cuckoo.jpg": JPEG, "call.mp3": MP3 });
    const result = await validate([
      cell(1, 1, "Birds"), cell(1, 2, "Name"), cell(1, 3, "Song"),
      cell(2, 2, "Cuckoo"), cell(2, 3, "cuckoo.jpg"),
      cell(3, 2, "Owl"), cell(3, 3, "call.mp3"),
    ]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "COLUMN_MEDIA_MIXED_KIND",
      severity: "error",
      location: expect.objectContaining({ column: 3, columnName: "Song" }),
    }));
  });

  it("reports COLUMN_MEDIA_MIXED_KIND when a column mixes media with text answers", async () => {
    await withMedia({ "cuckoo.jpg": JPEG });
    const result = await validate([
      cell(1, 1, "Birds"), cell(1, 2, "Name"), cell(1, 3, "Song"),
      cell(2, 2, "Cuckoo"), cell(2, 3, "cuckoo.jpg"),
      cell(3, 2, "Gull"), cell(3, 3, "loud squawking"),
    ]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "COLUMN_MEDIA_MIXED_KIND",
      severity: "error",
      location: expect.objectContaining({ column: 3, columnName: "Song" }),
    }));
  });
});
