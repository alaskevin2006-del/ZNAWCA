import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverCourses } from "../../src/core/course/loader.js";
import { organizeCourseFiles } from "../../src/core/course/organizer.js";
import { createCourseFixture } from "./xlsx-fixture.js";

describe("course file organizer", () => {
  it("creates a separately scannable copy without changing the selected folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-organizer-"));
    try {
      const { directory, workbook } = await createCourseFixture(root);
      const workbookBefore = await readFile(workbook);
      const workbookStatBefore = await stat(workbook);
      const sourceMedia = join(directory, "Common Cuckoo 01.png");
      await writeFile(sourceMedia, Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x00,
      ]));
      const mediaStatBefore = await stat(sourceMedia);

      const summary = await organizeCourseFiles(directory);
      const reports = await discoverCourses(summary.organizedDirectory);

      expect(summary).toMatchObject({
        sourceDirectory: directory,
        workbookCount: 1,
        copiedMediaCount: 1,
        unmatchedMediaCount: 0,
      });
      expect(summary.organizedDirectory).not.toBe(directory);
      // 源工作簿与源媒体：内容、时间戳、位置均不被程序修改。
      expect(await readFile(workbook)).toEqual(workbookBefore);
      expect((await stat(workbook)).mtimeMs).toBe(workbookStatBefore.mtimeMs);
      expect(await readFile(sourceMedia)).toHaveLength(12);
      expect((await stat(sourceMedia)).mtimeMs).toBe(mediaStatBefore.mtimeMs);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ canOpen: true, course: { title: "Fixture" } });
      expect(reports[0].course?.items.find((item) => item.name === "Common Cuckoo")?.media).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
