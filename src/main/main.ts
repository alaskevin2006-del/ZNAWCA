import { registerIpcHandlers } from "./ipc/register.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, net, protocol, screen } from "electron";

import { MEDIA_SCHEME, resolveMediaUrl } from "./media-protocol.js";

import { createWindowOptions } from "./window-options.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDirectory, "../..");
const allowedCourseRoots = new Set<string>();

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

async function createMainWindow(): Promise<BrowserWindow> {
  // 6.8：窗口按主屏工作区 75%×80% 自适应，不低于最小常规窗口 960×640。
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow(
    createWindowOptions(appRoot, {
      width: Math.max(960, Math.round(workArea.width * 0.75)),
      height: Math.max(640, Math.round(workArea.height * 0.8)),
    }),
  );

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
    return file
      ? net.fetch(pathToFileURL(file).toString())
      : new Response("Forbidden", { status: 403 });
  });
  registerIpcHandlers(
    path.join(app.getPath("userData"), "local-state-v1.json"),
    allowedCourseRoots,
  );
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
