import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { scanFeedbackSounds } from "./feedback-sounds.js";
import { parseLanguageWorkbookName } from "./language.js";
import { normalizeKey } from "./normalization.js";
import { scanCourseMedia } from "./media.js";
import type { CourseCatalogEntry, CourseIssue, CourseLoadReport } from "./types.js";
import { bidirectionalHeaderIssues } from "../quiz/course-adapter.js";
import { validateWorksheet } from "./validation.js";
import { validateV2Worksheet } from "./validation-v2.js";
import { readFirstWorksheet, XlsxReadError } from "./xlsx/xlsx-adapter.js";

export async function discoverCourses(rootDirectory: string): Promise<readonly CourseLoadReport[]> {
  let entries;
  try {
    entries = await readdir(rootDirectory, { withFileTypes: true });
  } catch (error) {
    return [failed("COURSE_ROOT_UNREADABLE", `Cannot read course root: ${messageOf(error)}`, "Choose an existing readable directory.", rootDirectory)];
  }
  const directories = entries.filter((entry) => entry.isDirectory());
  const candidates = await Promise.all(directories.map(async (entry) => {
    const directory = join(rootDirectory, entry.name);
    return await containsWorkbook(directory) ? directory : undefined;
  }));
  const courseDirectories = candidates
    .filter((directory): directory is string => directory !== undefined)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  if (courseDirectories.length > 0) {
    const reports = (await Promise.all(courseDirectories.map((directory) => loadCourseVersions(directory)))).flat();
    return rejectDuplicateCourseIds(reports);
  }

  const rootContainsWorkbook = entries.some((entry) =>
    entry.isFile() && extname(entry.name).toLowerCase() === ".xlsx" && !entry.name.startsWith("~$"));
  return rootContainsWorkbook ? await loadCourseVersions(rootDirectory) : [];
}

export async function discoverCourseCatalog(rootDirectory: string): Promise<readonly CourseCatalogEntry[]> {
  let entries;
  try {
    entries = await readdir(rootDirectory, { withFileTypes: true });
  } catch (error) {
    return [failedCatalog("COURSE_ROOT_UNREADABLE", `Cannot read course root: ${messageOf(error)}`, "Choose an existing readable directory.", rootDirectory, rootDirectory)];
  }
  const directories = entries.filter((entry) => entry.isDirectory());
  const candidates = await Promise.all(directories.map(async (entry) => {
    const directory = join(rootDirectory, entry.name);
    return await containsWorkbook(directory) ? directory : undefined;
  }));
  const courseDirectories = candidates
    .filter((directory): directory is string => directory !== undefined)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  if (courseDirectories.length > 0) return rejectDuplicateCatalogIds((await Promise.all(courseDirectories.map(readCourseCatalogEntries))).flat());

  const rootContainsWorkbook = entries.some((entry) =>
    entry.isFile() && extname(entry.name).toLowerCase() === ".xlsx" && !entry.name.startsWith("~$"));
  return rootContainsWorkbook ? await readCourseCatalogEntries(rootDirectory) : [];
}

/**
 * 加载一个课程目录可能产生的全部课程版本（V1 单工作簿 = 1 个；V2 多语言 = 每语言 1 个）。
 * 每个语言版本有独立的 course.id（含语言后缀），从而隔离学习/困难/测试记录。
 */
export async function loadCourseVersions(courseDirectory: string): Promise<CourseLoadReport[]> {
  let files;
  try {
    files = await readdir(courseDirectory, { withFileTypes: true });
  } catch (error) {
    return [failed("COURSE_DIRECTORY_UNREADABLE", `Cannot read course directory: ${messageOf(error)}`, "Check the directory permissions.", courseDirectory)];
  }
  const workbooks = files.filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".xlsx" && !entry.name.startsWith("~$"));
  if (workbooks.length === 0) return [failed("WORKBOOK_MISSING", "Course contains no .xlsx workbook.", "Add one workbook to the course directory.", courseDirectory)];

  // D-16：多语言工作簿识别。只要目录内全部工作簿都能解析为「基础名 + 语言后缀」
  // 且基础名完全一致（单个语言工作簿也算：单语言 V2 同样合法），就按多语言课程
  // 展开；否则保持原 WORKBOOK_AMBIGUOUS 语义（多个）或 V1 加载（单个无后缀）。
  {
    const parsed = workbooks.map((workbook) => ({ workbook, language: parseLanguageWorkbookName(workbook.name) }));
    const allLanguageSuffixed = parsed.every((entry) => entry.language !== undefined);
    const baseNames = new Set(parsed.map((entry) => entry.language?.base));
    if (allLanguageSuffixed && baseNames.size === 1) {
      const reports: CourseLoadReport[] = [];
      for (const { workbook, language } of parsed) {
        reports.push(await loadWorkbookAsCourse(courseDirectory, workbook.name, language!));
      }
      return reports;
    }
  }

  if (workbooks.length > 1) {
    const workbookNames = workbooks
      .map((workbook) => workbook.name)
      .sort((left, right) => left.localeCompare(right))
      .join(", ");
    return [failed("WORKBOOK_AMBIGUOUS", `Course contains ${workbooks.length} .xlsx workbooks: ${workbookNames}.`, "Keep one main workbook in the course directory.", courseDirectory)];
  }

  return [await loadWorkbookAsCourse(courseDirectory, workbooks[0].name)];
}

/** 单课程加载入口（chooseCourse 等），多语言目录返回第一个语言版本。 */
export async function loadCourse(courseDirectory: string): Promise<CourseLoadReport> {
  return (await loadCourseVersions(courseDirectory))[0];
}

export async function loadCourseVersion(courseDirectory: string, courseId: string): Promise<CourseLoadReport> {
  const reports = await loadCourseVersions(courseDirectory);
  return reports.find((report) => report.course?.id === courseId) ?? reports[0];
}

async function loadWorkbookAsCourse(
  courseDirectory: string,
  workbookName: string,
  language?: { readonly base: string; readonly language: string },
): Promise<CourseLoadReport> {
  const workbookPath = join(courseDirectory, workbookName);
  try {
    const worksheet = await readFirstWorksheet(workbookPath);
    if (language) {
      // V2：中性 A 列 + B 列名称 + C 起属性，媒体由单元格引用解析（D-17/D-18）。
      const validated = await validateV2Worksheet(worksheet, courseDirectory, workbookPath, language);
      const feedbackSounds = await scanFeedbackSounds(courseDirectory);
      const issues = [...validated.issues];
      // D-19 导入侧接线：非法 V2 双向表头（缺 `/` 或任一侧为空）按 error 计入
      // 课程导入 issues，使 canOpen=false；quiz 层的 BidirectionalHeaderError 仍是兜底。
      if (validated.course) issues.push(...bidirectionalHeaderIssues(validated.course));
      if (!validated.course) return { issues, canOpen: false };
      // D-22：speechFiles 由 validateV2Worksheet 扫描 speech/<lang>/ 得到（缺失目录
      // 得到空列表，静默跳过、不启用 TTS）；loader 只负责追加反馈音扫描结果。
      return { course: { ...validated.course, feedbackSounds }, issues, canOpen: !issues.some((entry) => entry.severity === "error") };
    }
    const itemNames = worksheet.cells
      .filter((cell) => cell.column === 1 && cell.row > 1 && cell.value.trim())
      .map((cell) => cell.value);
    const media = await scanCourseMedia(courseDirectory, itemNames);
    const feedbackSounds = await scanFeedbackSounds(courseDirectory);
    const validated = validateWorksheet(worksheet, courseDirectory, workbookPath, media.byItem);
    const issues = [...validated.issues, ...media.issues];
    if (!validated.course) return { issues, canOpen: false };
    const course = { ...validated.course, feedbackSounds };
    return { course, issues, canOpen: !issues.some((entry) => entry.severity === "error") };
  } catch (error) {
    const code = error instanceof XlsxReadError ? error.code : "WORKBOOK_INVALID";
    return failed(code, error instanceof Error ? error.message : String(error), "Repair or replace the workbook.", workbookPath);
  }
}

/**
 * D-16：多语言课程合并报告。任一语言工作簿阻断时整体不开放；否则合并各语言版本的
 * issues（去重），返回首份 course 作为代表（课程入口由 UI 按 languageCode 切换）。
 */
function failed(code: string, message: string, suggestion: string, file: string): CourseLoadReport {
  const issue: CourseIssue = { severity: "error", code, message, suggestion, location: { file } };
  return { issues: [issue], canOpen: false };
}

async function readCourseCatalogEntries(courseDirectory: string): Promise<CourseCatalogEntry[]> {
  let files;
  try {
    files = await readdir(courseDirectory, { withFileTypes: true });
  } catch (error) {
    return [failedCatalog("COURSE_DIRECTORY_UNREADABLE", `Cannot read course directory: ${messageOf(error)}`, "Check the directory permissions.", courseDirectory, courseDirectory)];
  }
  const workbooks = files
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".xlsx" && !entry.name.startsWith("~$"))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  if (workbooks.length === 0) {
    return [failedCatalog("WORKBOOK_MISSING", "Course contains no .xlsx workbook.", "Add one workbook to the course directory.", courseDirectory, courseDirectory)];
  }
  const parsed = workbooks.map((workbook) => ({ workbook, language: parseLanguageWorkbookName(workbook.name) }));
  const allLanguageSuffixed = parsed.every((entry) => entry.language !== undefined);
  const baseNames = new Set(parsed.map((entry) => entry.language?.base));
  if (allLanguageSuffixed && baseNames.size === 1) {
    return parsed.map(({ workbook, language }) => {
      const title = language!.base;
      const languageCode = language!.language;
      return {
        id: normalizeKey(`${title}_${languageCode}`),
        title: `${title} (${languageCode})`,
        directory: courseDirectory,
        workbookPaths: [join(courseDirectory, workbook.name)],
        languageCode,
        issues: [],
        canOpen: true,
      };
    });
  }
  if (workbooks.length > 1) {
    const workbookNames = workbooks.map((workbook) => workbook.name).join(", ");
    return [failedCatalog("WORKBOOK_AMBIGUOUS", `Course contains ${workbooks.length} .xlsx workbooks: ${workbookNames}.`, "Keep one main workbook in the course directory.", courseDirectory, courseDirectory)];
  }
  const workbookPath = join(courseDirectory, workbooks[0].name);
  const title = basename(workbooks[0].name, extname(workbooks[0].name));
  return [{
    id: normalizeKey(title),
    title,
    directory: courseDirectory,
    workbookPaths: [workbookPath],
    issues: [],
    canOpen: true,
  }];
}

function failedCatalog(code: string, message: string, suggestion: string, directory: string, file: string): CourseCatalogEntry {
  const issue: CourseIssue = { severity: "error", code, message, suggestion, location: { file } };
  return {
    id: normalizeKey(`${code}_${directory}`),
    title: basename(directory) || directory,
    directory,
    workbookPaths: [],
    issues: [issue],
    canOpen: false,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function courseIdFromWorkbook(workbookPath: string): string {
  return normalizeKey(basename(workbookPath, extname(workbookPath)));
}

function rejectDuplicateCourseIds(reports: readonly CourseLoadReport[]): readonly CourseLoadReport[] {
  const seen = new Map<string, string>();
  return reports.map((report) => {
    if (!report.canOpen || !report.course) return report;
    const existingDirectory = seen.get(report.course.id);
    if (!existingDirectory) {
      seen.set(report.course.id, report.course.directory);
      return report;
    }
    const duplicate: CourseIssue = {
      severity: "error",
      code: "COURSE_ID_DUPLICATE",
      message: `Another course already uses the title '${report.course.title}'.`,
      suggestion: "Rename one course workbook so every course in the library has a unique title.",
      location: { file: report.course.workbookPath },
    };
    return { issues: [...report.issues, duplicate], canOpen: false };
  });
}

function rejectDuplicateCatalogIds(entries: readonly CourseCatalogEntry[]): readonly CourseCatalogEntry[] {
  const seen = new Map<string, string>();
  return entries.map((entry) => {
    if (!entry.canOpen) return entry;
    const existingDirectory = seen.get(entry.id);
    if (!existingDirectory) {
      seen.set(entry.id, entry.directory);
      return entry;
    }
    const duplicate: CourseIssue = {
      severity: "error",
      code: "COURSE_ID_DUPLICATE",
      message: `Another course already uses the title '${entry.title}'.`,
      suggestion: "Rename one course workbook so every course in the library has a unique title.",
      location: { file: entry.workbookPaths[0] ?? entry.directory },
    };
    return { ...entry, issues: [...entry.issues, duplicate], canOpen: false };
  });
}

async function containsWorkbook(directory: string): Promise<boolean> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.some((entry) =>
      entry.isFile() && extname(entry.name).toLowerCase() === ".xlsx" && !entry.name.startsWith("~$"));
  } catch {
    return false;
  }
}
