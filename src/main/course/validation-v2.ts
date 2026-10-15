import { join } from "node:path";
import { scanCellMedia } from "./cell-media.js";
import { listSpeechAudioFiles } from "./media.js";
import { validateV2WorksheetContent } from "../../core/course/validation-v2.js";
import type { WorksheetData } from "../../core/course/types.js";

export async function validateV2Worksheet(
  worksheet: WorksheetData,
  directory: string,
  workbook: string,
  language: { readonly base: string; readonly language: string },
) {
  const media = await scanCellMedia(directory, workbook);
  const speechDirectory = join(directory, "speech", language.language);
  return validateV2WorksheetContent(worksheet, directory, workbook, language, {
    ...media,
    speechDirectory,
    speechFiles: await listSpeechAudioFiles(speechDirectory),
  });
}
