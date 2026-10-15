import path from "node:path";
import { dialog, ipcMain } from "electron";
import {
  discoverCourseCatalog,
  loadCourse,
  loadCourseVersion,
} from "../course/loader.js";
import { organizeCourseFiles } from "../course/organizer.js";
import { parseLocalState } from "../storage/parse.js";
import { IPC_CHANNELS } from "../../contracts/desktop-api.js";
import {
  readLocalState,
  writeLocalState,
} from "../storage/local-state-file.js";
import { resolveLibraryCourseDirectory } from "../path-security.js";
import {
  discoverLibrary,
  libraryFromCatalog,
  noCourseCandidates,
} from "../course/library-service.js";
import { withMediaUrls } from "../course/media-urls.js";

export function registerIpcHandlers(
  stateFile: string,
  allowedCourseRoots: Set<string>,
): void {
  ipcMain.handle(IPC_CHANNELS.chooseCourse, async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose a Znawca course folder",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const report = await loadCourse(result.filePaths[0]);
    if (!report.canOpen || !report.course) return report;
    allowedCourseRoots.add(path.resolve(report.course.directory));
    return withMediaUrls(report);
  });
  ipcMain.handle(
    IPC_CHANNELS.chooseCourseRoot,
    async (_event, requestedMode: unknown) => {
      const result = await dialog.showOpenDialog({
        title: "Choose a Znawca course or course library",
        properties: ["openDirectory"],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const sourceDirectory = path.resolve(result.filePaths[0]);
      // Every selection is checked before any file is copied or reorganized, but this catalog pass
      // deliberately avoids reading workbook contents or scanning media for every course.
      const initialCatalog = await discoverCourseCatalog(sourceDirectory);
      if (requestedMode === "organize") {
        const organization = await organizeCourseFiles(sourceDirectory);
        return {
          ...(await discoverLibrary(organization.organizedDirectory)),
          organization,
        };
      }
      return libraryFromCatalog(sourceDirectory, initialCatalog);
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.scanCourseRoot,
    (_event, rootDirectory: unknown) =>
      typeof rootDirectory === "string" && rootDirectory.trim()
        ? discoverLibrary(path.resolve(rootDirectory))
        : Promise.resolve({ rootDirectory: "", reports: [], catalog: [] }),
  );
  ipcMain.handle(
    IPC_CHANNELS.loadCourseFromLibrary,
    async (
      _event,
      rootDirectory: unknown,
      courseDirectory: unknown,
      courseId: unknown,
    ) => {
      if (
        typeof rootDirectory !== "string" ||
        !rootDirectory.trim() ||
        typeof courseDirectory !== "string" ||
        !courseDirectory.trim() ||
        typeof courseId !== "string" ||
        !courseId.trim()
      ) {
        return noCourseCandidates("");
      }
      const resolvedCourseDirectory = await resolveLibraryCourseDirectory(
        rootDirectory,
        courseDirectory,
      ).catch(() => undefined);
      if (!resolvedCourseDirectory)
        return noCourseCandidates(path.resolve(courseDirectory));
      const report = await loadCourseVersion(resolvedCourseDirectory, courseId);
      if (report.canOpen && report.course)
        allowedCourseRoots.add(path.resolve(report.course.directory));
      return withMediaUrls(report);
    },
  );
  ipcMain.handle(IPC_CHANNELS.loadLocalState, () => readLocalState(stateFile));
  ipcMain.handle(IPC_CHANNELS.saveLocalState, (_event, state: unknown) =>
    writeLocalState(stateFile, parseLocalState(JSON.stringify(state))),
  );
}
