import { waitFor, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/renderer/app/AppShell";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { smokeCourse } from "./course-fixture";

describe("course import flow", () => {
  it("shows actionable workbook errors returned by the desktop bridge", async () => {
    window.znawca = {
      loadLocalState: vi.fn().mockResolvedValue(defaultLocalState()),
      saveLocalState: vi.fn(),
      chooseCourse: vi.fn().mockResolvedValue({
        canOpen: false,
        issues: [{
          severity: "error",
          code: "WORKBOOK_MISSING",
          message: "Course contains no .xlsx workbook.",
          suggestion: "Add one workbook to the course directory.",
          location: { file: "C:/course" },
        }],
      }),
    };

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Course contains no .xlsx workbook");
  });

  it("opens imported image media as an independent question", async () => {
    window.znawca = {
      loadLocalState: vi.fn().mockResolvedValue(defaultLocalState()),
      saveLocalState: vi.fn(),
      chooseCourse: vi.fn().mockResolvedValue({
        canOpen: true,
        issues: [],
        course: {
          id: "birds", title: "Imported Birds", directory: "C:/Birds", workbookPath: "C:/Birds/birds.xlsx", sheetName: "Birds",
          columns: [
            { index: 2, title: "Habitat", displayTitle: "Habitat", filterOnly: false },
            { index: 3, title: "# Family", displayTitle: "Family", filterOnly: true },
          ],
          items: [{
            id: "robin", name: "Robin", sourceRow: 2, values: { Habitat: ["woodland"], "# Family": ["Thrushes"] },
            media: [{ kind: "image", path: "znawca-media://asset/example", extension: ".jpg", source: "standard" }],
          }],
        },
      }),
    };

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Scope and filters/ }));
    expect(screen.getByRole("group", { name: "Family" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    expect(screen.getByRole("img", { name: "Identify this object" })).toHaveAttribute("src", "znawca-media://asset/example");
  });

  it("opens a course despite media warnings and reports them with locations", async () => {
    window.znawca = {
      loadLocalState: vi.fn().mockResolvedValue(defaultLocalState()),
      saveLocalState: vi.fn(),
      chooseCourse: vi.fn().mockResolvedValue({
        canOpen: true,
        issues: [{
          severity: "warning",
          code: "MEDIA_CORRUPT",
          message: "Media file 'adult.jpg' does not match its declared format.",
          suggestion: "Replace or convert this file.",
          location: { file: "C:/Birds/Common Cuckoo/images/adult.jpg" },
        }],
        course: { ...smokeCourse, id: "birds-with-warning", directory: "C:/Birds" },
      }),
    };

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    // 单媒体警告不阻断进入课程与学习。
    expect(await screen.findByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
    // 回到课程列表：warning 默认折叠为一条横幅，不倾倒整屏；展开后才逐条可见。
    fireEvent.click(screen.getByRole("button", { name: /Znawca/i }));
    const toggle = await screen.findByRole("button", { name: /Course opened with warnings \(1\)/ });
    expect(toggle).toBeVisible();
    expect(screen.queryByText(/MEDIA_CORRUPT/)).toBeNull();
    fireEvent.click(toggle);
    expect(await screen.findByText(/MEDIA_CORRUPT/)).toBeVisible();
    expect(screen.getByText(/C:\/Birds\/Common Cuckoo\/images\/adult\.jpg/)).toBeVisible();
    // 消退机制：忽略后按指纹持久化并从视图移除，可一键恢复。
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/MEDIA_CORRUPT/)).toBeNull();
    await waitFor(() => {
      const saved = vi.mocked(window.znawca!.saveLocalState!).mock.calls.at(-1)?.[0];
      expect(saved?.settings.dismissedIssueKeys).toContain("MEDIA_CORRUPT|C:/Birds/Common Cuckoo/images/adult.jpg||||");
    });
    const restore = screen.getByRole("button", { name: /Dismissed: 1 · Restore/ });
    fireEvent.click(restore);
    expect(await screen.findByText(/MEDIA_CORRUPT/)).toBeVisible();
  });

  it("refreshes the saved library and discovers a newly added course", async () => {
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    const newCourse = {
      ...smokeCourse,
      id: "new-course",
      title: "New Course",
      directory: "C:/Courses/New",
      workbookPath: "C:/Courses/New/New.xlsx",
    };
    const scanCourseRoot = vi.fn()
      .mockResolvedValueOnce({
        rootDirectory: "C:/Courses",
        reports: [{ canOpen: true, issues: [], course: smokeCourse }],
      })
      .mockResolvedValueOnce({
        rootDirectory: "C:/Courses",
        reports: [
          { canOpen: true, issues: [], course: smokeCourse },
          { canOpen: true, issues: [], course: newCourse },
        ],
      });
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot,
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState: vi.fn(),
    };

    render(<AppShell />);
    expect(await screen.findByText("Smoke Course")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Refresh library" }));

    expect(await screen.findByText("New Course")).toBeVisible();
    expect(scanCourseRoot).toHaveBeenCalledTimes(2);
  });

  it("keeps saved library startup lightweight and loads only the opened course", async () => {
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    const loadCourseFromLibrary = vi.fn().mockResolvedValue({
      canOpen: true,
      issues: [],
      course: smokeCourse,
    });
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot: vi.fn().mockResolvedValue({
        rootDirectory: "C:/Courses",
        reports: [],
        catalog: [{
          id: smokeCourse.id,
          title: smokeCourse.title,
          directory: smokeCourse.directory,
          workbookPaths: [smokeCourse.workbookPath],
          issues: [],
          canOpen: true,
        }],
      }),
      loadCourseFromLibrary,
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState: vi.fn(),
    };

    render(<AppShell />);

    expect(await screen.findByText("Smoke Course")).toBeVisible();
    expect(loadCourseFromLibrary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open course" }));

    expect(await screen.findByText("Shape this session")).toBeVisible();
    expect(loadCourseFromLibrary).toHaveBeenCalledWith("C:/Courses", "C:/Courses/Smoke", "smoke-course");
  });

  it("does not start a duplicate course load when the same catalog card is clicked twice", async () => {
    const state = defaultLocalState();
    state.settings.courseRoot = "C:/Courses";
    let resolveLoad: (value: { canOpen: true; issues: []; course: typeof smokeCourse }) => void = () => undefined;
    const loadCourseFromLibrary = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveLoad = resolve as typeof resolveLoad;
    }));
    window.znawca = {
      chooseCourse: vi.fn(),
      scanCourseRoot: vi.fn().mockResolvedValue({
        rootDirectory: "C:/Courses",
        reports: [],
        catalog: [{
          id: smokeCourse.id,
          title: smokeCourse.title,
          directory: smokeCourse.directory,
          workbookPaths: [smokeCourse.workbookPath],
          issues: [],
          canOpen: true,
        }],
      }),
      loadCourseFromLibrary,
      loadLocalState: vi.fn().mockResolvedValue(state),
      saveLocalState: vi.fn(),
    };

    render(<AppShell />);

    const open = await screen.findByRole("button", { name: "Open course" });
    fireEvent.click(open);
    fireEvent.click(open);
    expect(loadCourseFromLibrary).toHaveBeenCalledTimes(1);

    resolveLoad({ canOpen: true, issues: [], course: smokeCourse });
    expect(await screen.findByText("Shape this session")).toBeVisible();
  });

  it("asks whether to organize, then scans through the selected import mode", async () => {
    const chooseCourseRoot = vi.fn().mockResolvedValue({
      rootDirectory: "C:/Courses",
      reports: [{ canOpen: true, issues: [], course: smokeCourse }],
    });
    window.znawca = {
      chooseCourse: vi.fn(),
      chooseCourseRoot,
      loadLocalState: vi.fn().mockResolvedValue(defaultLocalState()),
      saveLocalState: vi.fn(),
    };

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("scans the selected folder first");

    fireEvent.click(screen.getByRole("button", { name: /Scan without organizing/i }));

    expect(chooseCourseRoot).toHaveBeenCalledWith("scan");
    expect(await screen.findByText("Smoke Course")).toBeVisible();
  });
});
