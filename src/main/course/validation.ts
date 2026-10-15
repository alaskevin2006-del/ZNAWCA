import { basename, extname } from "node:path";
import { validateWorksheetContent } from "../../core/course/validation.js";
import type { WorksheetData, MediaAsset } from "../../core/course/types.js";

export function validateWorksheet(
  worksheet: WorksheetData,
  directory: string,
  workbook: string,
  media: ReadonlyMap<string, readonly MediaAsset[]> = new Map(),
) {
  return validateWorksheetContent(
    worksheet,
    directory,
    workbook,
    basename(workbook, extname(workbook)),
    media,
  );
}
