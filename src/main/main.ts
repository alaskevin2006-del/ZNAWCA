import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import type { CourseLoadReport } from "../core/course/types.js";
import { discoverCourseCatalog, loadCourse, loadCourseVersion } from "../core/course/loader.js";
import { organizeCourseFiles } from "../core/course/organizer.js";
import { parseLocalState, type LocalState } from "../core/persistence/index.js";
import { IPC_CHANNELS } from "../preload/contracts.js";
import { readLocalState, writeLocalState } from "./local-state-file.js";
import { MEDIA_SCHEME, mediaUrl, resolveMediaUrl } from "./media-protocol.js";
import { resolveLibraryCourseDirectory } from "./path-security.js";
import { createWindowOptions } from "./window-options.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDirectory, "../..");
const allowedCourseRoots = new Set<string>();

protocol.registerSchemesAsPrivileged([{
  scheme: MEDIA_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

function registerIpcHandlers(): void {
  const stateFile = path.join(app.getPath("userData"), "local-state-v1.json");
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
  ipcMain.handle(IPC_CHANNELS.chooseCourseRoot, async (_event, requestedMode: unknown) => {
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
      return { ...await discoverLibrary(organization.organizedDirectory), organization };
    }
    return libraryFromCatalog(sourceDirectory, initialCatalog);
  });
  ipcMain.handle(IPC_CHANNELS.scanCourseRoot, (_event, rootDirectory: unknown) =>
    typeof rootDirectory === "string" && rootDirectory.trim()
      ? discoverLibrary(path.resolve(rootDirectory))
      : Promise.resolve({ rootDirectory: "", reports: [], catalog: [] }));
  ipcMain.handle(IPC_CHANNELS.loadCourseFromLibrary, async (_event, rootDirectory: unknown, courseDirectory: unknown, courseId: unknown) => {
    if (
      typeof rootDirectory !== "string" || !rootDirectory.trim() ||
      typeof courseDirectory !== "string" || !courseDirectory.trim() ||
      typeof courseId !== "string" || !courseId.trim()
    ) {
      return noCourseCandidates("");
    }
    const resolvedCourseDirectory = await resolveLibraryCourseDirectory(rootDirectory, courseDirectory).catch(() => undefined);
    if (!resolvedCourseDirectory) return noCourseCandidates(path.resolve(courseDirectory));
    const report = await loadCourseVersion(resolvedCourseDirectory, courseId);
    if (report.canOpen && report.course) allowedCourseRoots.add(path.resolve(report.course.directory));
    return withMediaUrls(report);
  });
  ipcMain.handle(IPC_CHANNELS.loadLocalState, () => readLocalState(stateFile));
  ipcMain.handle(IPC_CHANNELS.saveLocalState, (_event, state: unknown) =>
    writeLocalState(stateFile, parseLocalState(JSON.stringify(state))));
}

async function discoverLibrary(rootDirectory: string) {
  return libraryFromCatalog(rootDirectory, await discoverCourseCatalog(rootDirectory));
}

function libraryFromCatalog(rootDirectory: string, discovered: Awaited<ReturnType<typeof discoverCourseCatalog>>) {
  const catalog = discovered.length > 0 ? discovered : [catalogFromReport(noCourseCandidates(rootDirectory), rootDirectory)];
  return {
    rootDirectory,
    reports: catalog.filter((entry) => !entry.canOpen).map((entry) => ({ canOpen: false, issues: entry.issues })),
    catalog,
  };
}

function noCourseCandidates(rootDirectory: string): CourseLoadReport {
  return {
    canOpen: false,
    issues: [{
      severity: "error",
      code: "COURSE_STRUCTURE_NOT_FOUND",
      message: "The selected folder does not yet contain a course that Znawca can create.",
      suggestion: "Add an XLSX workbook with a header row and learning content, or choose automatic organization.",
      location: { file: rootDirectory },
    }],
  };
}

function catalogFromReport(report: CourseLoadReport, rootDirectory: string) {
  return {
    id: "course-structure-not-found",
    title: path.basename(rootDirectory) || rootDirectory,
    directory: rootDirectory,
    workbookPaths: [],
    issues: report.issues,
    canOpen: false,
  };
}

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow(createWindowOptions(appRoot));

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.once("ready-to-show", () => window.show());

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    await window.loadURL(developmentUrl);
  } else {
    await window.loadFile(path.join(appRoot, "dist", "renderer", "index.html"));
  }

  return window;
}

app.whenReady().then(async () => {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const file = resolveMediaUrl(request.url, [...allowedCourseRoots]);
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response("Forbidden", { status: 403 });
  });
  registerIpcHandlers();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow();
  });
});

function withMediaUrls(report: CourseLoadReport): CourseLoadReport {
  if (!report.course) return report;
  const course = report.course;
  // D-22：把 speech/<lang>/ 坐标文件名转换为可直接播放的 znawca-media:// URL。
  const speech = course.speechFiles && course.speechDirectory
    ? course.speechFiles.map((file) => ({ file, url: mediaUrl(path.join(course.speechDirectory!, file)) }))
    : undefined;
  return {
    ...report,
    course: {
      ...course,
      items: course.items.map((item) => ({
        ...item,
        media: item.media.map((asset) => ({ ...asset, path: mediaUrl(asset.path) })),
      })),
      feedbackSounds: course.feedbackSounds
        ? {
            correct: course.feedbackSounds.correct.map(mediaUrl),
            incorrect: course.feedbackSounds.incorrect.map(mediaUrl),
          }
        : undefined,
      speech,
    },
  };
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
