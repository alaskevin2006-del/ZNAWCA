import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { AppShell } from "../../src/renderer/app/AppShell";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

// 客户反馈（Cumulonimbus）：与题目无关的关联图片不应显示——
// 非图片题的答错反馈区只显示正确答案文字，不再铺出该对象的全部图片；
// 媒体答案题的反馈区只渲染答案自身涉及的媒体。

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

describe("wrong-answer feedback does not show unrelated associated images", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows only the correct answer text without the object's image collection", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    installSmokeCourse(defaultLocalState(), previewCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    // 首题是 cuckoo 的 Scientific name 文字输入题（Math.random=0 的既定顺序）。
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Not quite$/)).toBeVisible();
    const feedback = document.querySelector<HTMLElement>(".feedback")!;
    // 文字题反馈区不得出现任何关联图片，即使该对象配有图片。
    expect(within(feedback).queryByRole("img")).toBeNull();
    expect(feedback.textContent).toContain("Cuculus canorus");
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
    // 选一个必然错误的选项：逐个尝试直到出现错误反馈。
    let submitted = false;
    for (const radio of [...radios].reverse()) {
      fireEvent.click(radio);
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
      if (screen.queryByText(/^Not quite$/)) { submitted = true; break; }
      fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    }
    expect(submitted).toBe(true);
    // 反馈区渲染的媒体只有既有两处：正确答案媒体 + 「多答」的错误选项媒体。
    const feedback = document.querySelector<HTMLElement>(".feedback")!;
    expect(within(feedback).getAllByRole("img")).toHaveLength(2);
  });
});
