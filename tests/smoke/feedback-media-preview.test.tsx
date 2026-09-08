import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/core/persistence";
import { AppShell } from "../../src/renderer/app-shell/AppShell";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

// ZNAWCA-15 补充任务A 自动验收（WORKBUDDY-TASKS.md §6）：
// 答错反馈区显示正确答案对应媒体的小图（AppShell 反馈区实现）。

const previewCourse: Course = {
  ...smokeCourse,
  items: smokeCourse.items.map((item) => ({
    ...item,
    media: [{ kind: "image", path: `C:/Courses/Media/${item.id}.jpg`, extension: "jpg", source: "standard" as const }],
  })),
};

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

describe("补充任务A: wrong-answer feedback shows the correct answer's media thumbnail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the correct object's image thumbnail next to the correct answer text", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    installSmokeCourse(defaultLocalState(), previewCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    // 首题是 cuckoo 的 Scientific name 文字输入题（Math.random=0 的既定顺序）。
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Not quite$/)).toBeVisible();
    const feedback = document.querySelector(".feedback")!;
    const thumbnails = within(feedback).getAllByRole("img");
    expect(thumbnails).toHaveLength(1);
    expect(thumbnails[0]!.getAttribute("src")).toContain("cuckoo.jpg");
  });

  it("does not duplicate media controls for media-answer questions", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    installSmokeCourse(defaultLocalState(), previewCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
    for (const name of allDirections) {
      const box = screen.getByRole("checkbox", { name }) as HTMLInputElement;
      if (box.checked !== (name === "Name to image")) fireEvent.click(box);
    }
    const input = screen.getByRole("checkbox", { name: "Text input" }) as HTMLInputElement;
    if (input.checked) fireEvent.click(input);
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    const radios = within(fieldset).getAllByRole("radio");
    // 选一个必然错误的选项：正确项的 img src 与任一错误项不同——用“选最后一个，
    // 若恰好答对则重选第一个”的兜底不可靠；改为逐个尝试直到出现错误反馈。
    let submitted = false;
    for (const radio of [...radios].reverse()) {
      fireEvent.click(radio);
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      if (screen.queryByText(/^Not quite$/)) { submitted = true; break; }
      fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    }
    expect(submitted).toBe(true);
    // 反馈区只渲染正确答案媒体本身一次，不再叠加对象小图。
    const feedback = document.querySelector(".feedback")!;
    expect(within(feedback).getAllByRole("img")).toHaveLength(1);
  });
});
