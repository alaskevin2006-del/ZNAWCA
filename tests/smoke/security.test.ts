import path from "node:path";
import { describe, expect, it } from "vitest";
import { createWindowOptions } from "../../src/main/window-options";
import { IPC_CHANNELS } from "../../src/contracts/desktop-api";

describe("Electron window security", () => {
  it("isolates the renderer from Node", () => {
    const options = createWindowOptions(path.resolve("C:/znawca"));
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
    expect(options.webPreferences?.preload).toContain("dist");
    expect(options.webPreferences?.preload).toMatch(/index\.cjs$/);
  });

  it("exposes only the required narrow IPC channels", () => {
    expect(Object.keys(IPC_CHANNELS)).toEqual([
      "chooseCourse", "chooseCourseRoot", "scanCourseRoot", "loadCourseFromLibrary", "loadLocalState", "saveLocalState",
    ]);
  });
});
