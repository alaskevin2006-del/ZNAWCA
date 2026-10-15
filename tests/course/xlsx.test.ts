import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFirstWorksheet } from "../../src/main/course/xlsx/xlsx-adapter.js";
import { createCourseFixture, createMergedCellFixture, createSelfClosingCellFixture } from "./xlsx-fixture.js";

describe("xlsx adapter", () => {
  let root: string;
  let workbook: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-xlsx-"));
    ({ workbook } = await createCourseFixture(root));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads the first worksheet from a generated fixture", async () => {
    const sheet = await readFirstWorksheet(workbook);
    expect(sheet.name).toBe("Fixture");
    expect(sheet.cells.find((cell) => cell.row === 1 && cell.column === 4)?.value).toBe("#Group");
    expect(sheet.cells.find((cell) => cell.row === 2 && cell.column === 1)?.value).toBe("Common Cuckoo");
  });

  it("keeps the A-column value when a self-closing empty cell precedes it", async () => {
    const { workbook: selfClosing } = await createSelfClosingCellFixture(root);
    const sheet = await readFirstWorksheet(selfClosing);
    expect(sheet.cells.find((cell) => cell.row === 2 && cell.column === 1)?.value).toBe("Granite");
    expect(sheet.cells.find((cell) => cell.row === 2 && cell.column === 2)?.value).toBe("Igneous");
    expect(sheet.cells.find((cell) => cell.row === 1 && cell.column === 4)?.value).toBe("");
  });

  it("propagates a merged A-column value into rows without an explicit cell", async () => {
    const { workbook: merged } = await createMergedCellFixture(root);
    const sheet = await readFirstWorksheet(merged);
    expect(sheet.cells.find((cell) => cell.row === 3 && cell.column === 1)?.value).toBe("Granite");
    expect(sheet.cells.find((cell) => cell.row === 4 && cell.column === 1)?.value).toBe("Basalt");
  });
});
