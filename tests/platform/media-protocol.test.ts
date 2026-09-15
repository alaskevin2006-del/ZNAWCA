import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mediaUrl, resolveMediaUrl } from "../../src/main/media-protocol";

describe("media protocol", () => {
  it("round trips media inside an approved course", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "znawca-media-"));
    try {
      const root = path.join(workspace, "Birds");
      const file = path.join(root, "Robin", "images", "one.jpg");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "image");

      expect(resolveMediaUrl(mediaUrl(file), [root])).toBe(file);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects files outside approved roots and malformed URLs", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "znawca-media-"));
    try {
      const root = path.join(workspace, "Birds");
      const outside = path.join(workspace, "private", "secret.txt");
      await mkdir(root, { recursive: true });
      await mkdir(path.dirname(outside), { recursive: true });
      await writeFile(outside, "secret");

      expect(resolveMediaUrl(mediaUrl(outside), [root])).toBeUndefined();
      expect(resolveMediaUrl("https://example.test/file", [root])).toBeUndefined();
      expect(resolveMediaUrl("znawca-media://asset/not-base64!", [root])).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("rejects approved-root links that resolve outside the course", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "znawca-media-link-"));
    try {
      const root = path.join(workspace, "Birds");
      const outside = path.join(workspace, "outside");
      const linked = path.join(root, "linked");
      const secret = path.join(linked, "secret.txt");
      await mkdir(root, { recursive: true });
      await mkdir(outside, { recursive: true });
      await writeFile(path.join(outside, "secret.txt"), "secret");
      await symlink(outside, linked, process.platform === "win32" ? "junction" : "dir");

      expect(resolveMediaUrl(mediaUrl(secret), [root])).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
