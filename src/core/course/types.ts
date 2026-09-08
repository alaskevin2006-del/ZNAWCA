export type IssueSeverity = "error" | "warning";

export interface IssueLocation {
  readonly file: string;
  readonly sheet?: string;
  readonly row?: number;
  readonly column?: number;
  readonly columnName?: string;
}

export interface CourseIssue {
  readonly severity: IssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly suggestion: string;
  readonly location: IssueLocation;
  /** 可选结构化参数：供 UI 层按界面语言本地化 message/suggestion（当前用于 ITEM_NAME_EMPTY 的非空列信息）。 */
  readonly params?: {
    readonly filledColumns?: readonly string[];
  };
}

export interface CourseColumn {
  readonly index: number;
  readonly title: string;
  readonly displayTitle: string;
  readonly filterOnly: boolean;
}

export type MediaKind = "image" | "audio" | "video";

export type MediaAssetSource = "standard" | "legacy-flat" | "cell";

export interface MediaAsset {
  readonly kind: MediaKind;
  readonly path: string;
  readonly extension: string;
  readonly source: MediaAssetSource;
}

/**
 * V2 媒体引用：单元格内声明的一个媒体变体。`refs` 为该单元格用 `/` 分隔的全部变体文件名
 * （原样保留），`paths` 为它们在共享 media/ 目录下解析后的真实路径。
 */
export interface CellMediaRef {
  readonly kind: MediaKind;
  readonly refs: readonly string[];
  readonly paths: readonly string[];
}

export interface CourseItem {
  readonly id: string;
  readonly name: string;
  readonly sourceRow: number;
  readonly values: Readonly<Record<string, readonly string[]>>;
  readonly media: readonly MediaAsset[];
  /** V2：属性单元格的媒体引用，key 为属性列标题；只表达该具体属性。 */
  readonly cellMedia?: Readonly<Record<string, readonly MediaAsset[]>>;
}

/** V2：内容语言代码，例如 `Eng`、`Ru`（工作簿语言后缀）。 */
export type CourseFormatVersion = "v1" | "v2";

export interface Course {
  readonly id: string;
  readonly title: string;
  /** V2：A1 单元格的课程显示名（按当前内容语言），缺省回退 title。 */
  readonly displayTitle?: string;
  /** V2：内容语言代码（如 `Eng`），V1 缺省。 */
  readonly languageCode?: string;
  /** V2：该内容语言的朗读音频目录 `speech/<lang>/`（D-16/D-22，S3 负责播放）。 */
  readonly speechDirectory?: string;
  /** 格式版本：v1=名称目录/整行媒体，v2=单元格媒体/多语言工作簿。 */
  readonly formatVersion?: CourseFormatVersion;
  /** 名称列的实际 Excel 列号：V1 为 1（A 列），V2 为 2（B 列）。缺省视为 1。 */
  readonly nameColumnIndex?: number;
  readonly directory: string;
  readonly workbookPath: string;
  readonly sheetName: string;
  readonly columns: readonly CourseColumn[];
  readonly items: readonly CourseItem[];
  /** D-12：课程根目录严格命名的正误提示音（`correct NN.mp3` / `incorrect NN.mp3`），无则缺省。 */
  readonly feedbackSounds?: { readonly correct: readonly string[]; readonly incorrect: readonly string[] };
}

export interface CourseLoadReport {
  readonly course?: Course;
  readonly issues: readonly CourseIssue[];
  readonly canOpen: boolean;
}

export interface WorksheetCell {
  readonly row: number;
  readonly column: number;
  readonly value: string;
  readonly hasFormula: boolean;
  readonly formulaHasCachedValue: boolean;
  /** 该值是否由合并单元格的左上角传播而来（非用户显式录入）。 */
  readonly merged?: boolean;
}

export interface WorksheetData {
  readonly file: string;
  readonly name: string;
  readonly cells: readonly WorksheetCell[];
}
