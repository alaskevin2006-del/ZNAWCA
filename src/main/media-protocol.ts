import path from "node:path";

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
    const candidate = path.resolve(Buffer.from(encoded, "base64url").toString("utf8"));
    return allowedRoots.some((root) => isWithin(root, candidate)) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
