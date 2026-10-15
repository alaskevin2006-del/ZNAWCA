import type { CourseOrganizationSummary } from "../../contracts/course-library.js";
import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, parse } from "node:path";
import {
  normalizeKey,
  normalizeWhitespace,
} from "../../core/course/normalization.js";
import { readFirstWorksheet } from "./xlsx/xlsx-adapter.js";

const MEDIA_DIRECTORIES: Readonly<
  Record<string, "images" | "audio" | "videos">
> = {
  ".jpg": "images",
  ".jpeg": "images",
  ".png": "images",
  ".webp": "images",
  ".bmp": "images",
  ".gif": "images",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".mp4": "videos",
};

interface SourceFile {
  readonly path: string;
  readonly name: string;
}

export async function organizeCourseFiles(
  sourceDirectory: string,
): Promise<CourseOrganizationSummary> {
  const workbooks = (await collectFiles(sourceDirectory)).filter(
    (file) =>
      extname(file.name).toLowerCase() === ".xlsx" &&
      !file.name.startsWith("~$"),
  );
  const organizedDirectory = await uniqueDirectory(
    join(
      dirname(sourceDirectory),
      `${basename(sourceDirectory)} - Znawca organized`,
    ),
  );
  await mkdir(organizedDirectory, { recursive: true });

  let copiedMediaCount = 0;
  const matchedMedia = new Set<string>();
  const allMedia = (await collectFiles(sourceDirectory)).filter(
    (file) => MEDIA_DIRECTORIES[extname(file.name).toLowerCase()] !== undefined,
  );

  for (const workbook of workbooks) {
    const courseName = parse(workbook.name).name;
    const courseDirectory = await uniqueChildDirectory(
      organizedDirectory,
      safePathSegment(courseName),
    );
    await mkdir(courseDirectory, { recursive: true });
    await copyFile(
      workbook.path,
      join(courseDirectory, `${safePathSegment(courseName)}.xlsx`),
    );

    let itemNames: readonly string[] = [];
    try {
      const worksheet = await readFirstWorksheet(workbook.path);
      itemNames = worksheet.cells
        .filter((cell) => cell.column === 1 && cell.row > 1)
        .map((cell) => normalizeWhitespace(cell.value))
        .filter(
          (value, index, values) =>
            Boolean(value) && values.indexOf(value) === index,
        );
    } catch {
      // The organized copy still includes an unreadable workbook so the normal
      // course validator can explain the exact workbook error to the user.
    }

    const workbookDirectory = dirname(workbook.path);
    const scopedMedia =
      workbooks.length === 1
        ? allMedia
        : allMedia.filter((file) => isInside(file.path, workbookDirectory));
    for (const media of scopedMedia) {
      const itemName = matchItem(media, itemNames);
      if (!itemName) continue;
      const mediaDirectory =
        MEDIA_DIRECTORIES[extname(media.name).toLowerCase()];
      const destinationDirectory = join(
        courseDirectory,
        safePathSegment(itemName),
        mediaDirectory,
      );
      await mkdir(destinationDirectory, { recursive: true });
      await copyFile(
        media.path,
        await uniqueFile(destinationDirectory, media.name),
      );
      matchedMedia.add(media.path);
      copiedMediaCount += 1;
    }
  }

  return {
    sourceDirectory,
    organizedDirectory,
    workbookCount: workbooks.length,
    copiedMediaCount,
    unmatchedMediaCount: allMedia.filter((file) => !matchedMedia.has(file.path))
      .length,
  };
}

async function collectFiles(directory: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push({ path, name: entry.name });
  }
  return files;
}

function matchItem(
  file: SourceFile,
  itemNames: readonly string[],
): string | undefined {
  const ancestorKeys = ancestorNames(dirname(file.path)).map(normalizeKey);
  const fileKey = normalizeKey(parse(file.name).name);
  return [...itemNames]
    .sort((left, right) => right.length - left.length)
    .find((itemName) => {
      const itemKey = normalizeKey(itemName);
      return (
        ancestorKeys.includes(itemKey) ||
        fileKey === itemKey ||
        fileKey.startsWith(`${itemKey} `)
      );
    });
}

function ancestorNames(directory: string): string[] {
  const names: string[] = [];
  let current = directory;
  while (true) {
    names.push(basename(current));
    const parent = dirname(current);
    if (parent === current) return names;
    current = parent;
  }
}

function isInside(file: string, directory: string): boolean {
  const relative = file.slice(directory.length);
  return (
    file.startsWith(directory) &&
    (relative.startsWith("\\") || relative.startsWith("/"))
  );
}

function safePathSegment(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")
      .replace(/[. ]+$/gu, "")
      .trim() || "Course"
  );
}

async function uniqueDirectory(preferred: string): Promise<string> {
  if (!(await exists(preferred))) return preferred;
  for (let index = 2; ; index += 1) {
    const candidate = `${preferred} (${index})`;
    if (!(await exists(candidate))) return candidate;
  }
}

async function uniqueChildDirectory(
  parent: string,
  name: string,
): Promise<string> {
  return uniqueDirectory(join(parent, name));
}

async function uniqueFile(directory: string, name: string): Promise<string> {
  const safeName = safePathSegment(parse(name).name);
  const extension = extname(name).toLowerCase();
  const preferred = join(directory, `${safeName}${extension}`);
  if (!(await exists(preferred))) return preferred;
  for (let index = 2; ; index += 1) {
    const candidate = join(directory, `${safeName} (${index})${extension}`);
    if (!(await exists(candidate))) return candidate;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
