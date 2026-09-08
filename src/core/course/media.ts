import { readFile, readdir } from "node:fs/promises";
import { extname, join, parse } from "node:path";
import { FEEDBACK_SOUND_PATTERN } from "./feedback-sound-select.js";
import { normalizeKey } from "./normalization.js";
import type { CourseIssue, MediaAsset, MediaKind } from "./types.js";

const EXTENSIONS: Readonly<Record<string, MediaKind>> = {
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".bmp": "image", ".gif": "image",
  ".mp3": "audio", ".wav": "audio", ".m4a": "audio",
  ".mp4": "video",
};

export { EXTENSIONS as SUPPORTED_MEDIA_EXTENSIONS };

const STANDARD_DIRECTORIES: Readonly<Record<string, MediaKind>> = {
  images: "image", audio: "audio", videos: "video",
};

export interface MediaScanResult {
  readonly byItem: ReadonlyMap<string, readonly MediaAsset[]>;
  readonly issues: readonly CourseIssue[];
}

export async function scanCourseMedia(courseDirectory: string, itemNames: readonly string[]): Promise<MediaScanResult> {
  const issues: CourseIssue[] = [];
  const byItem = new Map<string, MediaAsset[]>();
  const nameByKey = new Map(itemNames.map((name) => [normalizeKey(name), name]));
  for (const key of nameByKey.keys()) byItem.set(key, []);

  const entries = await safeReadDirectory(courseDirectory, issues);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const itemKey = normalizeKey(entry.name);
      if (!nameByKey.has(itemKey)) {
        issues.push(mediaIssue("MEDIA_DIRECTORY_UNMATCHED", `Media directory '${entry.name}' has no matching item.`, "Rename it to match column A exactly.", join(courseDirectory, entry.name)));
        continue;
      }
      await scanStandardDirectory(join(courseDirectory, entry.name), itemKey, byItem, issues);
      continue;
    }
    if (!entry.isFile() || extname(entry.name).toLowerCase() === ".xlsx") continue;
    // D-12：课程级正误提示音（correct/incorrect NN.mp3）不作为对象媒体，跳过以避免误报。
    if (FEEDBACK_SOUND_PATTERN.test(entry.name)) continue;
    const kind = EXTENSIONS[extname(entry.name).toLowerCase()];
    if (!kind) {
      issues.push(mediaIssue("MEDIA_UNSUPPORTED", `Unsupported file '${entry.name}'.`, "Use a supported image, audio, or MP4 file.", join(courseDirectory, entry.name)));
      continue;
    }
    const itemKey = matchLegacyPrefix(parse(entry.name).name, [...nameByKey.keys()]);
    if (!itemKey) {
      issues.push(mediaIssue("MEDIA_FILE_UNMATCHED", `Media file '${entry.name}' has no matching item prefix.`, "Move it into the matching object directory or rename its prefix.", join(courseDirectory, entry.name)));
      continue;
    }
    const filePath = join(courseDirectory, entry.name);
    if (await hasValidSignature(filePath, entry.name)) byItem.get(itemKey)?.push(asset(kind, filePath, "legacy-flat"));
    else issues.push(mediaIssue("MEDIA_CORRUPT", `Media file '${entry.name}' does not match its declared format.`, "Replace or convert this file.", filePath));
  }

  return { byItem, issues };
}

async function scanStandardDirectory(
  objectDirectory: string,
  itemKey: string,
  byItem: Map<string, MediaAsset[]>,
  issues: CourseIssue[],
): Promise<void> {
  const children = await safeReadDirectory(objectDirectory, issues);
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const expectedKind = STANDARD_DIRECTORIES[child.name.toLowerCase()];
    if (!expectedKind) continue;
    const mediaDirectory = join(objectDirectory, child.name);
    const mediaFiles = (await safeReadDirectory(mediaDirectory, issues)).filter((file) => file.isFile());
    if (mediaFiles.length === 0) {
      issues.push(mediaIssue("MEDIA_MISSING", `Media directory '${child.name}' is empty for this object.`, "Add media files, or remove the empty directory.", mediaDirectory));
      continue;
    }
    for (const file of mediaFiles) {
      const filePath = join(mediaDirectory, file.name);
      const actualKind = EXTENSIONS[extname(file.name).toLowerCase()];
      if (!actualKind) {
        issues.push(mediaIssue("MEDIA_UNSUPPORTED", `Unsupported file '${file.name}'.`, "Convert or remove this file.", filePath));
      } else if (actualKind !== expectedKind) {
        issues.push(mediaIssue("MEDIA_WRONG_DIRECTORY", `'${file.name}' is in the wrong media directory.`, `Move it to the ${directoryFor(actualKind)} directory.`, filePath));
      } else {
        if (await hasValidSignature(filePath, file.name)) byItem.get(itemKey)?.push(asset(actualKind, filePath, "standard"));
        else issues.push(mediaIssue("MEDIA_CORRUPT", `Media file '${file.name}' does not match its declared format.`, "Replace or convert this file.", filePath));
      }
    }
  }
}

async function safeReadDirectory(directory: string, issues: CourseIssue[]) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    issues.push(mediaIssue("MEDIA_DIRECTORY_UNREADABLE", `Cannot read directory: ${error instanceof Error ? error.message : String(error)}`, "Check that the directory exists and is readable.", directory));
    return [];
  }
}

function matchLegacyPrefix(baseName: string, keys: readonly string[]): string | undefined {
  const normalized = normalizeKey(baseName);
  return [...keys].sort((a, b) => b.length - a.length).find((key) => normalized === key || normalized.startsWith(`${key} `));
}

function asset(kind: MediaKind, path: string, source: MediaAsset["source"]): MediaAsset {
  return { kind, path, extension: extname(path).toLowerCase(), source };
}

function mediaIssue(code: string, message: string, suggestion: string, file: string): CourseIssue {
  return { severity: "warning", code, message, suggestion, location: { file } };
}

function directoryFor(kind: MediaKind): string {
  return kind === "image" ? "images" : kind === "audio" ? "audio" : "videos";
}

export async function hasValidSignature(file: string, name: string): Promise<boolean> {
  let bytes: Buffer;
  try {
    bytes = (await readFile(file)).subarray(0, 16);
  } catch {
    return false;
  }
  const extension = extname(name).toLowerCase();
  const ascii = bytes.toString("ascii");
  if (extension === ".jpg" || extension === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === ".png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === ".webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (extension === ".bmp") return ascii.startsWith("BM");
  if (extension === ".gif") return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  if (extension === ".wav") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
  if (extension === ".mp3") return ascii.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (extension === ".m4a" || extension === ".mp4") return ascii.slice(4, 8) === "ftyp";
  return false;
}
