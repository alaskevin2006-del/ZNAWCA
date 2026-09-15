import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPathInsideOrEqual, resolveLibraryCourseDirectory } from "../../src/main/path-security";

describe("library path security", () => {
  it("accepts paths inside or equal to the approved root", () => {
    const root = path.resolve("C:/courses");
    expect(isPathInsideOrEqual(root, root)).toBe(true);
    expect(isPathInsideOrEqual(path.join(root, "Birds"), root)).toBe(true);
  });

  it("rejects sibling paths outside the approved root", () => {
    const root = path.resolve("C:/courses");
    expect(isPathInsideOrEqual(path.resolve("C:/courses-other/Birds"), root)).toBe(false);
    expect(isPathInsideOrEqual(path.resolve("C:/private/Birds"), root)).toBe(false);
  });

  it("resolves symlinks before accepting a library course directory", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "znawca-path-"));
    try {
      const root = path.join(workspace, "library");
      const inside = path.join(root, "Inside");
      const outside = path.join(workspace, "outside");
      const link = path.join(root, "LinkedOutside");
      await mkdir(inside, { recursive: true });
      await mkdir(outside, { recursive: true });
      await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");

      await expect(resolveLibraryCourseDirectory(root, inside)).resolves.toBe(await realpath(inside));
      await expect(resolveLibraryCourseDirectory(root, link)).resolves.toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
