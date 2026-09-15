import { realpathSync } from "node:fs";
import path from "node:path";
import { isPathInsideOrEqual } from "./path-security.js";

export const MEDIA_SCHEME = "znawca-media";

export function mediaUrl(file: string): string {
  return `${MEDIA_SCHEME}://asset/${Buffer.from(path.resolve(file), "utf8").toString("base64url")}`;
}

export function resolveMediaUrl(url: string, allowedRoots: readonly string[]): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== "asset") return undefined;
    const encoded = parsed.pathname.slice(1);
    if (!encoded) return undefined;
    const candidate = realpathSync(path.resolve(Buffer.from(encoded, "base64url").toString("utf8")));
    return allowedRoots.some((root) => {
      try {
        return isPathInsideOrEqual(candidate, realpathSync(path.resolve(root)));
      } catch {
        return false;
      }
    }) ? candidate : undefined;
  } catch {
    return undefined;
  }
}
