import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/core/persistence";
import { AppShell } from "../../src/renderer/app-shell/AppShell";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

function mediaAsset(id: string, kind: "image" | "audio" | "video") {
  const extension = kind === "image" ? "jpg" : kind === "audio" ? "mp3" : "mp4";
  return { kind, path: `C:/Courses/Media/${id}.${extension}`, extension, source: "standard" as const };
}

const mediaCourse: Course = {
  ...smokeCourse,
  id: "media-course",
  title: "Media Course",
  directory: "C:/Courses/Media",
  workbookPath: "C:/Courses/Media/Media.xlsx",
  items: smokeCourse.items.map((item) => ({
    ...item,
    media: [mediaAsset(item.id, "image"), mediaAsset(item.id, "audio"), mediaAsset(item.id, "video")],
  })),
};

const threeItemMediaCourse: Course = { ...mediaCourse, items: mediaCourse.items.slice(0, 3) };

const allDirections = [
  "Name to property",
  "Property to name",
  "Image to name",
  "Name to image",
  "Audio to name",
  "Name to audio",
  "Video to name",
  "Name to video",
];

// 只保留一个题型方向 + 只开 Multiple choice，使学习会话首题即为该方向的媒体选择题。
async function beginChoiceSession(course: Course, keepDirection: string) {
  render(<AppShell />);
  fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
  for (const name of allDirections) {
    const box = screen.getByRole("checkbox", { name }) as HTMLInputElement;
    if (box.checked !== (name === keepDirection)) fireEvent.click(box);
  }
  const input = screen.getByRole("checkbox", { name: "Text input" }) as HTMLInputElement;
  if (input.checked) fireEvent.click(input);
  fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
}

describe("D-11 media choice grid", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks four image options with the media grid and renders selectable options", async () => {
    installSmokeCourse(defaultLocalState(), mediaCourse);
    await beginChoiceSession(mediaCourse, "Name to image");
    expect(screen.getByText("0 / 4 mastered")).toBeVisible();
    expect(document.querySelector(".content")?.className).toContain("content-session");
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    expect(fieldset.className).toContain("media-grid");
    expect(fieldset.querySelectorAll("img")).toHaveLength(4);
    expect(document.querySelector(".question-card")?.className).toContain("media-grid-card");
    const radios = within(fieldset).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    fireEvent.click(radios[2]);
    expect(radios[2]).toBeChecked();
  });

  it("marks four audio options with the media grid and keeps audio controls operable", async () => {
    installSmokeCourse(defaultLocalState(), mediaCourse);
    await beginChoiceSession(mediaCourse, "Name to audio");
    expect(screen.getByText("0 / 4 mastered")).toBeVisible();
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    expect(fieldset.className).toContain("media-grid");
    const controls = fieldset.querySelectorAll("audio");
    expect(controls).toHaveLength(4);
    for (const control of controls) expect(control.controls).toBe(true);
    const radios = within(fieldset).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    fireEvent.click(radios[0]);
    expect(radios[0]).toBeChecked();
  });

  it("stops the previous audio option when another one starts playing", async () => {
    installSmokeCourse(defaultLocalState(), mediaCourse);
    await beginChoiceSession(mediaCourse, "Name to audio");
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    const controls = fieldset.querySelectorAll("audio");
    const firstPause = vi.spyOn(controls[0]!, "pause").mockImplementation(() => {});

    fireEvent.play(controls[0]!);
    fireEvent.play(controls[1]!);

    expect(firstPause).toHaveBeenCalledTimes(1);
  });

  it("keeps three media options on two rows with the grid mark", async () => {
    installSmokeCourse(defaultLocalState(), threeItemMediaCourse);
    await beginChoiceSession(threeItemMediaCourse, "Name to image");
    expect(screen.getByText("0 / 3 mastered")).toBeVisible();
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    expect(fieldset.className).toContain("media-grid");
    expect(within(fieldset).getAllByRole("radio")).toHaveLength(3);
    expect(fieldset.querySelectorAll("img")).toHaveLength(3);
  });

  it("does not mark plain text choice questions", async () => {
    installSmokeCourse(defaultLocalState(), mediaCourse);
    await beginChoiceSession(mediaCourse, "Name to property");
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    expect(fieldset.className).not.toContain("media-grid");
    expect(within(fieldset).getAllByRole("radio")).toHaveLength(4);
    expect(fieldset.querySelectorAll("img, audio, video")).toHaveLength(0);
  });

  it("marks four video options with the media grid (D-25)", async () => {
    installSmokeCourse(defaultLocalState(), mediaCourse);
    await beginChoiceSession(mediaCourse, "Name to video");
    expect(screen.getByText("0 / 4 mastered")).toBeVisible();
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    expect(fieldset.className).toContain("media-grid");
    expect(fieldset.querySelectorAll("video")).toHaveLength(4);
    expect(document.querySelector(".question-card")?.className).toContain("media-grid-card");
    const radios = within(fieldset).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    fireEvent.click(radios[1]);
    expect(radios[1]).toBeChecked();
  });

  it("compresses media options and the question card for the 960×640 minimum window", () => {
    // jsdom 不做真实布局（getBoundingClientRect 恒为 0），这里退而校验 CSS 源码中的关键紧凑值，
    // 防止回归到宽松尺寸导致 2×2 第二行在最小窗口被裁切。真实像素级验证需浏览器环境（Playwright）。
    const choicesCss = readFileSync(resolve(process.cwd(), "src/renderer/app-shell/choices.css"), "utf8");
    // clamp(下限, 18vh, 上限)：下限保证 960×640 两行可见（18vh@640=115px 仍在预算内），
    // 上限防止超大显示器过度拉伸。这里校验 clamp 下限不超过最小窗口安全值。
    const imgHeight = choicesCss.match(/\.choice-list\.media-grid \.question-media img\s*\{[^}]*max-height:\s*clamp\((\d+)px/);
    expect(imgHeight).not.toBeNull();
    expect(Number(imgHeight![1])).toBeLessThanOrEqual(130);

    // D-25：视频选项在 2×2 网格内同样收窄
    const videoHeight = choicesCss.match(/\.choice-list\.media-grid \.question-media video\s*\{[^}]*max-height:\s*clamp\((\d+)px/);
    expect(videoHeight).not.toBeNull();
    expect(Number(videoHeight![1])).toBeLessThanOrEqual(130);

    const shellCss = readFileSync(resolve(process.cwd(), "src/renderer/app-shell/app-shell.css"), "utf8");
    expect(shellCss).toMatch(/\.question-card\{padding:1[0-9]px 20px;margin-top:8px\}/);
    // 媒体网格场景额外压缩题干下方间距，防止第二行在最小窗口被推出视口。
    expect(shellCss).toMatch(/\.question-card\.media-grid-card h1\{margin-bottom:1[0-9]px/);
  });
});
