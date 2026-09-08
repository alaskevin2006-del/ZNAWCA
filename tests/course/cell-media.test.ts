import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanCellMedia } from "../../src/core/course/cell-media.js";

describe("cell media resolver", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "znawca-cellmedia-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function withMedia(files: Record<string, Buffer | string>): Promise<ReturnType<typeof scanCellMedia>> {
    const mediaDir = join(root, "media");
    await mkdir(mediaDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(mediaDir, name), content);
    }
    return scanCellMedia(root);
  }

  it("resolves a single referenced image", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const { resolve, issues } = await withMedia({ "flag.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]) , "bird.jpg": jpeg });
    const assets = await resolve("flag.png", "Birds", 2, 1, "Flag");
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ kind: "image", source: "cell", extension: ".png" });
    expect(issues).toEqual([]);
  });

  it("resolves multiple /-separated variants of the same media type", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const { resolve } = await withMedia({ "front.jpg": jpeg, "waving.jpg": jpeg });
    const assets = await resolve("front.jpg/waving.jpg", "Birds", 2, 1);
    expect(assets).toHaveLength(2);
    expect(assets.every((asset) => asset.kind === "image")).toBe(true);
  });

  it("treats a plain text answer as non-media", async () => {
    const { resolve, issues } = await withMedia({});
    const assets = await resolve("insects; seeds", "Birds", 2, 3, "Diet");
    expect(assets).toEqual([]);
    expect(issues).toEqual([]);
  });

  it("warns with location when a referenced file is missing", async () => {
    const { resolve, issues } = await withMedia({});
    await resolve("missing.png", "Birds", 2, 1, "Flag");
    expect(issues).toContainEqual(expect.objectContaining({
      code: "CELL_MEDIA_MISSING",
      severity: "warning",
      location: expect.objectContaining({ row: 2, column: 1 }),
    }));
  });

  it("warns when a referenced file is corrupt", async () => {
    const { resolve, issues } = await withMedia({ "bad.jpg": "not a jpeg" });
    const assets = await resolve("bad.jpg", "Birds", 2, 1);
    expect(assets).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({ code: "CELL_MEDIA_CORRUPT" }));
  });

  it("rejects a cell that mixes different media kinds", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const { resolve, issues } = await withMedia({ "flag.jpg": jpeg, "call.mp3": "ID3" });
    const assets = await resolve("flag.jpg/call.mp3", "Birds", 2, 1, "Flag");
    expect(assets).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({
      code: "CELL_MEDIA_MIXED_KIND",
      severity: "warning",
      location: expect.objectContaining({ row: 2, column: 1 }),
    }));
  });
});
