import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { scanCourseMedia } from "../../src/main/course/media.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("course media scanning", () => {
  it("maps standard folders and compatible legacy flat files", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await mkdir(join(root, "Common Cuckoo", "images"), { recursive: true });
    await mkdir(join(root, "Common Cuckoo", "audio"), { recursive: true });
    await writeFile(join(root, "Common Cuckoo", "images", "adult.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    await writeFile(join(root, "Common Cuckoo", "audio", "call.wav"), Buffer.from("RIFF0000WAVE"));
    await writeFile(join(root, "Black-headed Gull 00.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const result = await scanCourseMedia(root, ["Common Cuckoo", "Black-headed Gull"]);
    expect(result.issues).toEqual([]);
    expect(result.byItem.get("common cuckoo")).toHaveLength(2);
    expect(result.byItem.get("black-headed gull")?.[0]).toMatchObject({ kind: "image", source: "legacy-flat" });
  });

  it("warns about a damaged supported file", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await mkdir(join(root, "Known Bird", "images"), { recursive: true });
    await writeFile(join(root, "Known Bird", "images", "broken.jpg"), "not a jpeg");
    const result = await scanCourseMedia(root, ["Known Bird"]);
    expect(result.byItem.get("known bird")).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MEDIA_CORRUPT" }));
  });

  it("warns instead of inventing a match", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await writeFile(join(root, "Unknown Bird.mp3"), "mock");
    const result = await scanCourseMedia(root, ["Known Bird"]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MEDIA_FILE_UNMATCHED", severity: "warning" }));
  });

  it("warns with the file path when a media file uses an unsupported extension", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await writeFile(join(root, "notes.txt"), "not media");
    const result = await scanCourseMedia(root, ["Known Bird"]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "MEDIA_UNSUPPORTED",
      severity: "warning",
      location: expect.objectContaining({ file: join(root, "notes.txt") }),
    }));
  });

  it("warns with the file path when a media file sits in the wrong media directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await mkdir(join(root, "Known Bird", "images"), { recursive: true });
    await writeFile(join(root, "Known Bird", "images", "call.mp3"), Buffer.from("ID3mock"));
    const result = await scanCourseMedia(root, ["Known Bird"]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "MEDIA_WRONG_DIRECTORY",
      severity: "warning",
      location: expect.objectContaining({ file: join(root, "Known Bird", "images", "call.mp3") }),
    }));
  });

  it("warns with the directory path when a standard media directory is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await mkdir(join(root, "Known Bird", "images"), { recursive: true });
    const result = await scanCourseMedia(root, ["Known Bird"]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "MEDIA_MISSING",
      severity: "warning",
      location: expect.objectContaining({ file: join(root, "Known Bird", "images") }),
    }));
  });

  it("does not misreport course-level feedback sounds as object media", async () => {
    const root = await mkdtemp(join(tmpdir(), "znawca-media-"));
    temporary.push(root);
    await writeFile(join(root, "correct 00.mp3"), "mock");
    await writeFile(join(root, "incorrect 99.mp3"), "mock");
    const result = await scanCourseMedia(root, ["Known Bird"]);
    expect(result.issues).toEqual([]);
  });
});
