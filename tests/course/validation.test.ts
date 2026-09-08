import { describe, expect, it } from "vitest";
import { validateWorksheet } from "../../src/core/course/validation.js";
import type { WorksheetData } from "../../src/core/course/types.js";

function worksheet(cells: WorksheetData["cells"]): WorksheetData {
  return { file: "Birds.xlsx", name: "Birds", cells };
}

describe("course worksheet validation", () => {
  it("parses filter columns and semicolon-separated values", () => {
    const result = validateWorksheet(worksheet([
      { row: 1, column: 1, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Food?", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 3, value: "#Habitat", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 1, value: "Gull", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "fish; worms", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 3, value: "coast; wetland", hasFormula: false, formulaHasCachedValue: true },
    ]), "C:/Birds", "C:/Birds/Birds.xlsx");

    expect(result.issues).toEqual([]);
    expect(result.course?.columns[2]).toMatchObject({ filterOnly: true, displayTitle: "Habitat" });
    expect(result.course?.items[0].values["Food?"]).toEqual(["fish", "worms"]);
  });

  it("reports duplicate names with a source row", () => {
    const result = validateWorksheet(worksheet([
      { row: 1, column: 1, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Type?", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 1, value: "Granite", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "Igneous", hasFormula: false, formulaHasCachedValue: true },
      { row: 3, column: 1, value: " granite ", hasFormula: false, formulaHasCachedValue: true },
      { row: 3, column: 2, value: "Igneous", hasFormula: false, formulaHasCachedValue: true },
    ]), "C:/Rocks", "C:/Rocks/Rocks.xlsx");
    expect(result.course).toBeUndefined();
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "ITEM_NAME_DUPLICATE", location: expect.objectContaining({ row: 3, column: 1 }) }));
  });

  it("blocks a workbook with headers but no items and points at file and sheet", () => {
    const result = validateWorksheet(worksheet([
      { row: 1, column: 1, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Type?", hasFormula: false, formulaHasCachedValue: true },
    ]), "C:/Rocks", "C:/Rocks/Rocks.xlsx");
    expect(result.course).toBeUndefined();
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "NO_VALID_ITEMS",
      severity: "error",
      suggestion: expect.stringContaining("Add at least one named item"),
      location: expect.objectContaining({ file: "Birds.xlsx", sheet: "Birds" }),
    }));
  });

  it("blocks a course with items but no question columns and no media", () => {
    const result = validateWorksheet(worksheet([
      { row: 1, column: 1, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 1, value: "Granite", hasFormula: false, formulaHasCachedValue: true },
    ]), "C:/Rocks", "C:/Rocks/Rocks.xlsx");
    expect(result.course).toBeUndefined();
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "NO_LEARNING_CONTENT",
      severity: "error",
      suggestion: expect.stringContaining("Add a normal question column or supported media"),
      location: expect.objectContaining({ file: "Birds.xlsx", sheet: "Birds" }),
    }));
  });

  it("reports ITEM_NAME_EMPTY with row and column context when A is empty but other columns have values", () => {
    const result = validateWorksheet(worksheet([
      { row: 1, column: 1, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Type?", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 1, value: "", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 2, value: "Igneous", hasFormula: false, formulaHasCachedValue: true },
    ]), "C:/Rocks", "C:/Rocks/Rocks.xlsx");
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "ITEM_NAME_EMPTY",
      message: expect.stringContaining("Row 2"),
      suggestion: expect.stringContaining("column A is empty"),
      location: expect.objectContaining({ row: 2, column: 1 }),
      params: expect.objectContaining({ filledColumns: ["B"] }),
    }));
  });

  it("does not report ITEM_NAME_EMPTY for a formula cell without a cached value", () => {
    const result = validateWorksheet(worksheet([
      { row: 1, column: 1, value: "Name", hasFormula: false, formulaHasCachedValue: true },
      { row: 1, column: 2, value: "Type?", hasFormula: false, formulaHasCachedValue: true },
      { row: 2, column: 1, value: "", hasFormula: true, formulaHasCachedValue: false },
      { row: 2, column: 2, value: "Igneous", hasFormula: false, formulaHasCachedValue: true },
    ]), "C:/Rocks", "C:/Rocks/Rocks.xlsx");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FORMULA_VALUE_MISSING" }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: "ITEM_NAME_EMPTY" }));
  });
});
