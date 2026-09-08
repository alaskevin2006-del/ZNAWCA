import { describe, expect, it } from "vitest";
import { parseLanguageWorkbookName } from "../../src/core/course/language.js";

describe("parseLanguageWorkbookName", () => {
  it("parses a 3-letter language suffix", () => {
    expect(parseLanguageWorkbookName("Birds_Eng.xlsx")).toEqual({ base: "Birds", language: "Eng" });
  });

  it("parses a 2-letter language suffix", () => {
    expect(parseLanguageWorkbookName("Birds_Ru.xlsx")).toEqual({ base: "Birds", language: "Ru" });
  });

  it("returns undefined for a name without a language suffix", () => {
    expect(parseLanguageWorkbookName("Birds.xlsx")).toBeUndefined();
    expect(parseLanguageWorkbookName("Igneous and Sedimentary Rocks.xlsx")).toBeUndefined();
  });

  it("returns undefined for a language code that is not 2-3 letters", () => {
    expect(parseLanguageWorkbookName("Birds_English.xlsx")).toBeUndefined();
    expect(parseLanguageWorkbookName("Birds_E.xlsx")).toBeUndefined();
  });

  it("returns undefined for a numeric or mixed suffix", () => {
    expect(parseLanguageWorkbookName("Birds_v2.xlsx")).toBeUndefined();
    expect(parseLanguageWorkbookName("Birds_2024.xlsx")).toBeUndefined();
  });

  it("trims the base name", () => {
    expect(parseLanguageWorkbookName(" Birds_Eng.xlsx")).toEqual({ base: "Birds", language: "Eng" });
  });
});
