import {
  cellMediaCategory,
  type CellMediaResolver,
  type CellMediaScanResult,
} from "../../core/course/media-rules.js";
export { cellMediaCategory } from "../../core/course/media-rules.js";
import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { SUPPORTED_MEDIA_EXTENSIONS, hasValidSignature } from "./media.js";
import type {
  CourseIssue,
  MediaAsset,
  MediaKind,
} from "../../core/course/types.js";

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

export async function scanCellMedia(
  courseDirectory: string,
  workbookPath?: string,
): Promise<CellMediaScanResult> {
  const issues: CourseIssue[] = [];
  const mediaDirectory = join(courseDirectory, MEDIA_DIRECTORY);
  // 单元格级问题定位到工作簿文件（D-14：文件/工作表/行列齐全）；无工作簿上下文时回退 media 目录。
  const issueFile = workbookPath ?? mediaDirectory;
  const entries = await safeReadDirectory(mediaDirectory, issues);
  const files = entries.filter((entry) => entry.isFile());

  // 「文件名（大小写不敏感）→ 绝对路径」索引，供单元格引用解析。
  const byName = new Map<string, string>();
  for (const file of files) {
    byName.set(file.name.toLowerCase(), join(mediaDirectory, file.name));
  }

  const resolve: CellMediaResolver = async (
    rawValue,
    sheet,
    row,
    column,
    columnName,
  ) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];
    const category = cellMediaCategory(trimmed);
    if (category === "text") return [];

    // D-18：同一单元格只允许一种媒体类别及其变体；媒体引用与文字混写同样禁止，导入失败。
    if (category === "mixed") {
      issues.push(
        cellIssue(
          "error",
          "CELL_MEDIA_MIXED_KIND",
          "Cell mixes media of different kinds, or a media reference with plain text.",
          "Use one media kind per cell; put text answers in a different column and separate media variants with '/'.",
          issueFile,
          sheet,
          row,
          column,
          columnName,
        ),
      );
      return [];
    }

    // D-18：`/` 只作变体分隔，引用必须是 media/ 中的纯文件名，不得含路径。
    if (partsOf(trimmed).some((part) => part.includes("\\"))) {
      issues.push(
        cellIssue(
          "error",
          "CELL_MEDIA_PATH",
          "Cell references media with a path; only plain file names are allowed.",
          "Put the file in the media directory and reference it by file name only, e.g. 'flag.png'.",
          issueFile,
          sheet,
          row,
          column,
          columnName,
        ),
      );
      return [];
    }

    const assets: MediaAsset[] = [];
    for (const ref of partsOf(trimmed)) {
      const path = byName.get(ref.toLowerCase());
      if (!path) {
        issues.push(
          cellIssue(
            "warning",
            "CELL_MEDIA_MISSING",
            `Referenced media file '${ref}' was not found in the media directory.`,
            "Add the file to the media directory or remove the reference.",
            issueFile,
            sheet,
            row,
            column,
            ref,
          ),
        );
        continue;
      }
      const kind = SUPPORTED_MEDIA_EXTENSIONS[extname(ref).toLowerCase()];
      if (!kind) continue;
      if (await hasValidSignature(path, ref)) {
        assets.push({
          kind,
          path,
          extension: extname(ref).toLowerCase(),
          source: "cell",
        });
      } else {
        issues.push(
          cellIssue(
            "warning",
            "CELL_MEDIA_CORRUPT",
            `Referenced media file '${ref}' does not match its declared format.`,
            "Replace or convert this file.",
            path,
            sheet,
            row,
            column,
            ref,
          ),
        );
      }
    }
    return assets;
  };

  return { resolve, issues };
}

export function mediaKindOf(value: string): MediaKind | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const category = cellMediaCategory(trimmed);
  return typeof category === "object" ? category.kind : undefined;
}

function partsOf(rawValue: string): readonly string[] {
  return rawValue
    .trim()
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function safeReadDirectory(
  directory: string,
  issues: CourseIssue[],
): Promise<readonly { isFile(): boolean; name: string }[]> {
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

function cellIssue(
  severity: "error" | "warning",
  code: string,
  message: string,
  suggestion: string,
  file: string,
  sheet: string,
  row: number,
  column: number,
  columnName?: string,
): CourseIssue {
  return {
    severity,
    code,
    message,
    suggestion,
    location: { file, sheet, row, column, columnName },
  };
}
