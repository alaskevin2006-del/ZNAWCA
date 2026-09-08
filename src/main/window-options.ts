import path from "node:path";
import type { BrowserWindowConstructorOptions } from "electron";

export function createWindowOptions(appRoot: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#102a20",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appRoot, "dist", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };
}
