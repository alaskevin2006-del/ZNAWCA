import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { SUPPORTED_MEDIA_EXTENSIONS, hasValidSignature } from "./media.js";
import type { CourseIssue, MediaAsset, MediaKind } from "./types.js";

/**
 * V2 单元格媒体引用解析（D-17 / D-18）。
 *
 * V2 中媒体放在共享 `media/` 目录，单元格写文件名（不含路径），例如：
 * - A 列（主媒体）：`flag.png` 或 `flag-front.png/flag-waving.jpg`（`/` 分隔多个变体）
 * - 属性单元格：文本答案，或同样写文件名表示该属性是媒体
 *
 * 单元格内容含受支持扩展名时按媒体引用处理；文件在 `media/` 中精确存在且格式受支持时
 * 识别为媒体（不显示文件名），缺失/损坏只产生可定位 warning 并跳过。
 */

const MEDIA_DIRECTORY = "media";

export interface CellMediaResolver {
  /** 解析一个单元格值为媒体资产列表；纯文本返回空数组。 */
  (rawValue: string, sheet: string, row: number, column: number, columnName?: string): Promise<readonly MediaAsset[]>;
}

export interface CellMediaScanResult {
  readonly resolve: CellMediaResolver;
  readonly issues: readonly CourseIssue[];
}

export async function scanCellMedia(courseDirectory: string): Promise<CellMediaScanResult> {
  const issues: CourseIssue[] = [];
  const mediaDirectory = join(courseDirectory, MEDIA_DIRECTORY);
  const entries = await safeReadDirectory(mediaDirectory, issues);
  const files = entries.filter((entry) => entry.isFile());

  // 「文件名（大小写不敏感）→ 绝对路径」索引，供单元格引用解析。
  const byName = new Map<string, string>();
  for (const file of files) {
    byName.set(file.name.toLowerCase(), join(mediaDirectory, file.name));
  }

  const resolve: CellMediaResolver = async (rawValue, sheet, row, column, columnName) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];
    const parts = trimmed.split("/").map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length === 0) return [];

    // 只有每个变体都含受支持扩展名时才整体按媒体处理；否则按纯文本答案处理。
    const allMedia = parts.every((part) => SUPPORTED_MEDIA_EXTENSIONS[extname(part).toLowerCase()] !== undefined);
    if (!allMedia) return [];

    // D-18：同一单元格的多个变体必须属于同一媒体类别（图片列内可混用 JPG/PNG/WEBP）。
    const kinds = new Set(parts.map((part) => SUPPORTED_MEDIA_EXTENSIONS[extname(part).toLowerCase()]));
    if (kinds.size > 1) {
      issues.push(cellIssue("CELL_MEDIA_MIXED_KIND", `Cell mixes different media kinds (${[...kinds].join(", ")}).`, "Use one media kind per cell; put other kinds in a different column.", mediaDirectory, sheet, row, column, columnName));
      return [];
    }

    const assets: MediaAsset[] = [];
    for (const ref of parts) {
      const path = byName.get(ref.toLowerCase());
      if (!path) {
        issues.push(cellIssue("CELL_MEDIA_MISSING", `Referenced media file '${ref}' was not found in the media directory.`, "Add the file to the media directory or remove the reference.", mediaDirectory, sheet, row, column, ref));
        continue;
      }
      const kind = SUPPORTED_MEDIA_EXTENSIONS[extname(ref).toLowerCase()];
      if (!kind) continue;
      if (await hasValidSignature(path, ref)) {
        assets.push({ kind, path, extension: extname(ref).toLowerCase(), source: "cell" });
      } else {
        issues.push(cellIssue("CELL_MEDIA_CORRUPT", `Referenced media file '${ref}' does not match its declared format.`, "Replace or convert this file.", path, sheet, row, column, ref));
      }
    }
    return assets;
  };

  return { resolve, issues };
}

export function mediaKindOf(value: string): MediaKind | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return SUPPORTED_MEDIA_EXTENSIONS[extname(trimmed).toLowerCase()];
}

async function safeReadDirectory(directory: string, issues: CourseIssue[]): Promise<readonly { isFile(): boolean; name: string }[]> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    // 目录不存在（ENOENT）表示该课程没有媒体，纯文字课程合法，静默跳过。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    issues.push({
      severity: "warning",
      code: "MEDIA_DIRECTORY_UNREADABLE",
      message: `Cannot read media directory: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: "Check that the media directory exists and is readable.",
      location: { file: directory },
    });
    return [];
  }
}

function cellIssue(code: string, message: string, suggestion: string, file: string, sheet: string, row: number, column: number, columnName?: string): CourseIssue {
  return { severity: "warning", code, message, suggestion, location: { file, sheet, row, column, columnName } };
}
