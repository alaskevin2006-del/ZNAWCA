import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/core/persistence";
import { AppShell } from "../../src/renderer/app-shell/AppShell";
import { markCourseMastered } from "./course-fixture";

const mediaCourse: Course = {
  id: "media-course",
  title: "Media Course",
  directory: "C:/Media",
  workbookPath: "C:/Media/course.xlsx",
  sheetName: "Objects",
  columns: [{ index: 2, title: "Fact", displayTitle: "Fact", filterOnly: false }],
  items: ["Alpha", "Bravo", "Charlie", "Delta"].map((name, index) => ({
    id: name.toLowerCase(),
    name,
    sourceRow: index + 2,
    values: { Fact: [`Fact ${name}`] },
    media: (["image", "audio", "video"] as const).map((kind) => ({
      kind,
      path: `znawca-media://asset/${name.toLowerCase()}.${kind}`,
      extension: kind === "image" ? ".jpg" : kind === "audio" ? ".mp3" : ".mp4",
      source: "standard" as const,
    })),
  })),
};

const emptyCourse: Course = {
  ...mediaCourse,
  id: "empty-course",
  title: "Empty Imported Course",
  columns: [],
  items: [{
    id: "only-object",
    name: "Only Object",
    sourceRow: 2,
    values: {},
    media: [],
  }],
};

function installBridge(course: Course = mediaCourse, mastered = false) {
  const saveLocalState = vi.fn().mockResolvedValue(undefined);
  window.znawca = {
    chooseCourse: vi.fn().mockResolvedValue({ canOpen: true, issues: [], course }),
    loadLocalState: vi.fn().mockResolvedValue(mastered ? markCourseMastered(defaultLocalState(), course) : defaultLocalState()),
    saveLocalState,
  };
  return { saveLocalState };
}

describe("P0 desktop acceptance contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installBridge();
  });

  it("shows detailed Testing results and stores an accessible history entry", async () => {
    const { saveLocalState } = installBridge(mediaCourse, true);
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<AppShell />);
    await waitFor(() => expect(window.znawca!.loadLocalState).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Testing/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Multiple choice" }));
    for (const label of [
      "Property to name", "Image to name", "Name to image",
      "Audio to name", "Name to audio", "Video to name", "Name to video",
    ]) {
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin Testing/i }));
    for (let index = 0; index < 3; index += 1) {
      fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    }

    expect(screen.getByText(/Correct\s+0/i)).toBeVisible();
    expect(screen.getByText(/Incorrect\s+3/i)).toBeVisible();
    expect(screen.queryByText(/Partial\s+\d+/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review answers/i })).toBeEnabled();
    expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({
      testHistory: expect.arrayContaining([
        expect.objectContaining({
          courseId: "media-course",
          timerSeconds: 0,
          summary: expect.objectContaining({
            records: expect.arrayContaining([
              expect.objectContaining({ questionId: expect.any(String), evaluation: expect.objectContaining({ score: 0 }) }),
            ]),
          }),
        }),
      ]),
    }));

    fireEvent.click(screen.getAllByRole("button", { name: "Courses" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Open course" }).at(-1)!);
    expect(screen.getByRole("button", { name: /^Test history/ })).toBeEnabled();
  });

  it("offers both directions for every real-course media kind and renders media choices", async () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));

    for (const direction of [
      "Image to name", "Name to image",
      "Audio to name", "Name to audio",
      "Video to name", "Name to video",
    ]) {
      expect(screen.getByRole("checkbox", { name: direction })).toBeEnabled();
    }
    expect(document.querySelector(".setup-footer")).toHaveTextContent(/16 projects/i);
  });

  it.each([
    ["image", "Name to image", "Identify this object"],
    ["audio", "Name to audio", "Identify this object Audio"],
    ["video", "Name to video", "Identify this object Video"],
  ] as const)("renders name-to-%s choices as media controls", async (kind, enabledDirection, mediaLabel) => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Text input" }));
    for (const label of [
      "Name to property", "Property to name", "Image to name", "Name to image",
      "Audio to name", "Name to audio", "Video to name", "Name to video",
    ]) {
      if (label !== enabledDirection) fireEvent.click(screen.getByRole("checkbox", { name: label }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));

    const media = kind === "image"
      ? screen.getAllByAltText(mediaLabel)
      : screen.getAllByLabelText(mediaLabel);
    expect(media.length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole("radio", { name: new RegExp(`Select media option ${kind}`, "i") }).length).toBeGreaterThanOrEqual(3);
  });

  it("does not substitute demo questions when an imported course has no usable questions", async () => {
    installBridge(emptyCourse);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByText("Shape this session")).toBeVisible();
    expect(document.querySelector(".setup-footer")).toHaveTextContent(/0 \/ 0 projects/i);
    expect(screen.getByRole("button", { name: /Begin learning/i })).toBeDisabled();
    expect(screen.queryByText(/Common Cuckoo/i)).not.toBeInTheDocument();
  });

  it("shows the correct-answer thumbnail (not a path string) in feedback after a wrong name-to-image answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add course or library" }));
    expect(await screen.findByText("Shape this session")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Text input" }));
    for (const label of ["Name to property", "Property to name", "Image to name", "Audio to name", "Name to audio", "Video to name", "Name to video"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Smart batch" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Questions" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));

    const radios = screen.getAllByRole("radio", { name: /Select media option image/i });
    expect(radios.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    // 答错后反馈区应渲染正确图片缩略图（<img>），而非把媒体路径当字符串显示。
    const feedback = document.querySelector(".feedback");
    expect(feedback).not.toBeNull();
    expect(feedback!.querySelector("img")).not.toBeNull();
    expect(feedback!.textContent).not.toContain("znawca-media://");
  });
});
