import path from "node:path";
import { describe, expect, it } from "vitest";
import { mediaUrl, resolveMediaUrl } from "../../src/main/media-protocol";

describe("media protocol", () => {
  const root = path.resolve("C:/courses/Birds");

  it("round trips media inside an approved course", () => {
    const file = path.join(root, "Robin", "images", "one.jpg");
    expect(resolveMediaUrl(mediaUrl(file), [root])).toBe(file);
  });

  it("rejects files outside approved roots and malformed URLs", () => {
    expect(resolveMediaUrl(mediaUrl("C:/private/secret.txt"), [root])).toBeUndefined();
    expect(resolveMediaUrl("https://example.test/file", [root])).toBeUndefined();
    expect(resolveMediaUrl("znawca-media://asset/not-base64!", [root])).toBeUndefined();
  });
});
