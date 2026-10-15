import type { CourseIssue, MediaAsset, MediaKind } from "./types.js";

export const SUPPORTED_MEDIA_EXTENSIONS: Readonly<Record<string, MediaKind>> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".bmp": "image",
  ".gif": "image",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".mp4": "video",
};

export interface CellMediaResolver {
  /** 解析一个单元格值为媒体资产列表；纯文本返回空数组。 */
  (
    rawValue: string,
    sheet: string,
    row: number,
    column: number,
    columnName?: string,
  ): Promise<readonly MediaAsset[]>;
}

export interface CellMediaScanResult {
  readonly resolve: CellMediaResolver;
  readonly issues: readonly CourseIssue[];
}

/**
 * 单元格引用语法判定的类别：
 * - `{ kind }`：全部 `/` 变体都是同一类受支持媒体（图片/音频/视频）。
 * - `"text"`：不含任何受支持媒体扩展名，按纯文本答案处理。
 * - `"mixed"`：同格混入多种媒体类别，或媒体引用与文字混写（D-18 禁止）。
 *
 * 该判定只看语法（扩展名），不依赖文件是否真实存在；文件缺失/损坏由 resolve 报 warning。
 */
export type CellMediaCategory = { readonly kind: MediaKind } | "text" | "mixed";

export function cellMediaCategory(rawValue: string): CellMediaCategory {
  const parts = rawValue
    .trim()
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "text";
  const mediaParts = parts.filter(
    (part) =>
      SUPPORTED_MEDIA_EXTENSIONS[extensionOf(part).toLowerCase()] !== undefined,
  );
  if (mediaParts.length === 0) return "text";
  if (mediaParts.length !== parts.length) return "mixed";
  const kinds = new Set(
    mediaParts.map(
      (part) => SUPPORTED_MEDIA_EXTENSIONS[extensionOf(part).toLowerCase()],
    ),
  );
  return kinds.size === 1 ? { kind: [...kinds][0]! } : "mixed";
}

function extensionOf(value: string): string {
  const name = value.split(/[\\/]/).at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot <= 0 || name === ".." ? "" : name.slice(dot);
}
