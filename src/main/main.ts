import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import type { CourseLoadReport } from "../core/course/types.js";
import { discoverCourses, loadCourse } from "../core/course/loader.js";
import { organizeCourseFiles } from "../core/course/organizer.js";
import { parseLocalState, type LocalState } from "../core/persistence/index.js";
import { IPC_CHANNELS } from "../preload/contracts.js";
import { readLocalState, writeLocalState } from "./local-state-file.js";
import { MEDIA_SCHEME, mediaUrl, resolveMediaUrl } from "./media-protocol.js";
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
    // Every selection is scanned before any file is copied or reorganized.
    const initialReports = await discoverCourses(sourceDirectory);
    if (requestedMode === "organize") {
      const organization = await organizeCourseFiles(sourceDirectory);
      return { ...await discoverLibrary(organization.organizedDirectory), organization };
    }
    return libraryFromReports(sourceDirectory, initialReports);
  });
  ipcMain.handle(IPC_CHANNELS.scanCourseRoot, (_event, rootDirectory: unknown) =>
    typeof rootDirectory === "string" && rootDirectory.trim()
      ? discoverLibrary(path.resolve(rootDirectory))
      : Promise.resolve({ rootDirectory: "", reports: [] }));
  ipcMain.handle(IPC_CHANNELS.loadLocalState, () => readLocalState(stateFile));
  ipcMain.handle(IPC_CHANNELS.saveLocalState, (_event, state: unknown) =>
    writeLocalState(stateFile, parseLocalState(JSON.stringify(state))));
}

async function discoverLibrary(rootDirectory: string) {
  return libraryFromReports(rootDirectory, await discoverCourses(rootDirectory));
}

function libraryFromReports(rootDirectory: string, discovered: readonly CourseLoadReport[]) {
  const reports = discovered.length > 0 ? discovered : [noCourseCandidates(rootDirectory)];
  for (const report of reports) {
    if (report.canOpen && report.course) allowedCourseRoots.add(path.resolve(report.course.directory));
  }
  return { rootDirectory, reports: reports.map(withMediaUrls) };
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
  return {
    ...report,
    course: {
      ...report.course,
      items: report.course.items.map((item) => ({
        ...item,
        media: item.media.map((asset) => ({ ...asset, path: mediaUrl(asset.path) })),
      })),
      feedbackSounds: report.course.feedbackSounds
        ? {
            correct: report.course.feedbackSounds.correct.map(mediaUrl),
            incorrect: report.course.feedbackSounds.incorrect.map(mediaUrl),
          }
        : undefined,
    },
  };
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
