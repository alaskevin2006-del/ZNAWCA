import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/renderer/app/AppShell";
import { defaultLocalState } from "../../src/application/state/defaults";
import type { CourseLibraryReport } from "../../src/contracts/desktop-api";

describe("persistence feedback", () => {
  it("keeps settings changed while the startup library scan is in flight", async () => {
    const initial = defaultLocalState();
    initial.settings.courseRoot = "C:/Courses";
    let finishScan!: (report: CourseLibraryReport) => void;
    const scan = new Promise<CourseLibraryReport>((resolve) => {
      finishScan = resolve;
    });
    const scanCourseRoot = vi.fn().mockReturnValue(scan);
    const saveLocalState = vi.fn().mockResolvedValue(undefined);
    window.znawca = {
      chooseCourse: vi.fn(),
      loadLocalState: async () => initial,
      scanCourseRoot,
      saveLocalState,
    };
    render(<AppShell />);
    await waitFor(() =>
      expect(scanCourseRoot).toHaveBeenCalledWith("C:/Courses"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Interface language"), {
      target: { value: "ru" },
    });
    await act(async () => {
      finishScan({ rootDirectory: "C:/Courses", reports: [], catalog: [] });
      await scan;
    });
    await waitFor(() =>
      expect(saveLocalState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            locale: "ru",
            courseRoot: "C:/Courses",
            courseCatalogCache: [],
          }),
        }),
      ),
    );
    expect(document.documentElement.lang).toBe("ru");
  });

  it("keeps a language edit visible after saving fails and retries it", async () => {
    const saveLocalState = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    window.znawca = {
      chooseCourse: vi.fn(),
      loadLocalState: async () => defaultLocalState(),
      saveLocalState,
    };
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Interface language"), {
      target: { value: "zh-CN" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "本地数据读写失败",
    );
    expect(document.documentElement.lang).toBe("zh-CN");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(saveLocalState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ locale: "zh-CN" }),
      }),
    );
  });
});
