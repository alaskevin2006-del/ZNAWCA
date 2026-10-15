import { contextBridge, ipcRenderer } from "electron";
import type { LocalState } from "../contracts/local-state.js";
import type { ZnawcaDesktopApi } from "../contracts/desktop-api.js";

// Sandboxed Electron preload scripts cannot load local runtime modules.
// Keep the narrow channel list self-contained so this file compiles to one CJS entry.
const IPC_CHANNELS = {
  chooseCourse: "course:choose-and-load",
  chooseCourseRoot: "course:choose-root-and-discover",
  scanCourseRoot: "course:scan-saved-root",
  loadCourseFromLibrary: "course:load-from-library",
  loadLocalState: "state:load",
  saveLocalState: "state:save",
} as const satisfies typeof import("../contracts/desktop-api.js").IPC_CHANNELS;

const desktopApi: Readonly<ZnawcaDesktopApi> = Object.freeze({
  chooseCourse: () => ipcRenderer.invoke(IPC_CHANNELS.chooseCourse),
  chooseCourseRoot: (mode = "scan") => ipcRenderer.invoke(IPC_CHANNELS.chooseCourseRoot, mode),
  scanCourseRoot: (rootDirectory: string) => ipcRenderer.invoke(IPC_CHANNELS.scanCourseRoot, rootDirectory),
  loadCourseFromLibrary: (rootDirectory: string, courseDirectory: string, courseId: string) => ipcRenderer.invoke(IPC_CHANNELS.loadCourseFromLibrary, rootDirectory, courseDirectory, courseId),
  loadLocalState: () => ipcRenderer.invoke(IPC_CHANNELS.loadLocalState),
  saveLocalState: (state: LocalState) => ipcRenderer.invoke(IPC_CHANNELS.saveLocalState, state),
});

contextBridge.exposeInMainWorld("znawca", desktopApi);
