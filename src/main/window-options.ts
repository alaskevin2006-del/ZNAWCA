import path from "node:path";
import type { BrowserWindowConstructorOptions } from "electron";

// 尺寸由 main 进程按屏幕工作区注入（本函数保持纯函数，node 测试环境无 electron screen）。
// 缺省 1280×800；下限 960×640 与 minWidth/minHeight 一致。
export function createWindowOptions(appRoot: string, size?: { width: number; height: number }): BrowserWindowConstructorOptions {
  return {
    width: size?.width ?? 1280,
    height: size?.height ?? 800,
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
