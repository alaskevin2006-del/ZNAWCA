import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCourseVersions } from "../../src/main/course/loader.js";
import type { CourseLoadReport } from "../../src/core/course/types.js";
import { createMultilingualCourseFixture, writeWorkbookRows } from "./xlsx-fixture.js";

// 补充任务 B（D-19 导入侧接线）：非法 V2 双向表头必须在课程导入阶段就报
// error 级 issue 且 canOpen=false，而不是等到 quiz 层才抛 BidirectionalHeaderError。
describe("V2 bidirectional header import blocking (D-19 loader wiring)", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-v2header-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function eng(reports: readonly CourseLoadReport[]): CourseLoadReport {
    const report = reports.find((entry) => entry.issues.some((issue) => issue.location.file?.includes("_Eng.xlsx")))
      ?? reports.find((entry) => entry.course?.languageCode === "Eng");
    expect(report, "expected the Eng course version").toBeDefined();
    return report!;
  }

  it("blocks import with HEADER_BIDIRECTIONAL_MISSING when a V2 header lacks '/'", async () => {
    const { directory, engWorkbook } = await createMultilingualCourseFixture(root);
    await writeWorkbookRows(engWorkbook, [
      ["Birds of Europe", "Name / Bird", "Diet"],
      ["cuckoo.jpg", "Common Cuckoo", "insects"],
    ]);
    const reports = await loadCourseVersions(directory);
    const report = eng(reports);
    expect(report.canOpen).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "HEADER_BIDIRECTIONAL_MISSING",
      severity: "error",
      location: expect.objectContaining({ file: engWorkbook, row: 1, column: 3, columnName: "Diet" }),
    }));
    // 同一目录的其他语言版本不受影响。
    expect(reports.find((entry) => entry.course?.languageCode === "Ru")?.canOpen).toBe(true);
  });

  it("blocks import with HEADER_BIDIRECTIONAL_SIDE_EMPTY when one stem side is blank", async () => {
    const { directory, engWorkbook } = await createMultilingualCourseFixture(root);
    await writeWorkbookRows(engWorkbook, [
      ["Birds of Europe", "Name / Bird", "Diet / "],
      ["cuckoo.jpg", "Common Cuckoo", "insects"],
    ]);
    const reports = await loadCourseVersions(directory);
    const report = eng(reports);
    expect(report.canOpen).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "HEADER_BIDIRECTIONAL_SIDE_EMPTY",
      severity: "error",
      location: expect.objectContaining({ file: engWorkbook, row: 1, column: 3, columnName: "Diet /" }),
    }));
  });

  it("keeps the course openable when every V2 header carries both stems", async () => {
    const { directory } = await createMultilingualCourseFixture(root);
    const reports = await loadCourseVersions(directory);
    expect(reports).toHaveLength(2);
    for (const report of reports) {
      expect(report.canOpen).toBe(true);
      expect(report.issues.filter((issue) => issue.code.startsWith("HEADER_BIDIRECTIONAL"))).toEqual([]);
    }
  });
});
