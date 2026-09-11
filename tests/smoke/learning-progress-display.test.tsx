import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultLocalState } from "../../src/core/persistence";
import { AppShell } from "../../src/renderer/app-shell/AppShell";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

// D-26 自动验收（反馈⑦后补）：Learning 进度展示改为「已掌握 / 未掌握」。
// 顶部不再显示被问次数（Question X of Y——答错重做会让次数超过总题数），
// 计数与进度条都按进度单位计算：答对才推进，答错重入队保持不动。
// smokeCourse＝4 对象 × 2 个学习列＝8 个进度单位。

function track(): HTMLElement {
  return document.querySelector<HTMLElement>(".progress-track")!;
}

function filledPercent(): number {
  return parseFloat(track().querySelector<HTMLElement>("span")!.style.width);
}

async function answerOnce(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
  fireEvent.click(screen.getByRole("button", { name: "Next question" }));
}

async function beginTextInputLearningSession() {
  render(<AppShell />);
  fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
  // 只保留文字输入题：答案可精确控制（"wrong" 必错），choice 首项可能恰好答对。
  const input = screen.getByRole("checkbox", { name: "Text input" }) as HTMLInputElement;
  if (!input.checked) fireEvent.click(input);
  const choice = screen.getByRole("checkbox", { name: "Multiple choice" }) as HTMLInputElement;
  if (choice.checked) fireEvent.click(choice);
  fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
  await screen.findByText("0 / 8 mastered");
}

describe("D-26 learning progress shows mastered vs remaining", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  it("replaces the asked-count header with mastered counts and a unit-based progress bar", async () => {
    installSmokeCourse(defaultLocalState(), smokeCourse);
    await beginTextInputLearningSession();
    // 顶部：已掌握计数（不再显示 Question X of Y 被问次数）。
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
    expect(screen.getByText("0 / 8 units · 8 remaining")).toBeVisible();
    expect(screen.queryByText(/Question \d+ of \d+/)).toBeNull();
    // 进度条：mastered 段 0%，remaining 段为轨道背景。
    expect(filledPercent()).toBe(0);
    expect(track().getAttribute("role")).toBe("progressbar");
    expect(track().getAttribute("aria-valuemin")).toBe("0");
    expect(track().getAttribute("aria-valuemax")).toBe("8");
    expect(track().getAttribute("aria-valuenow")).toBe("0");
  });

  it("advances only on a correct answer and stays flat after a wrong retry", async () => {
    installSmokeCourse(defaultLocalState(), smokeCourse);
    await beginTextInputLearningSession();
    // 首题（Math.random=0 的既定顺序）：cuckoo 的 Scientific name 输入题。
    // 首次答对即达到移除条件（requiredStreak=1）→ 1 个单位已掌握。
    await answerOnce("Cuculus canorus");
    expect(await screen.findByText("1 / 8 mastered")).toBeVisible();
    expect(filledPercent()).toBeCloseTo(12.5, 5);
    expect(track().getAttribute("aria-valuenow")).toBe("1");
    // 下一题答错 → 重入队，但已掌握数与进度条不动（不被问次数推挤）。
    await answerOnce("wrong");
    expect(await screen.findByText("1 / 8 mastered")).toBeVisible();
    expect(filledPercent()).toBeCloseTo(12.5, 5);
    expect(track().getAttribute("aria-valuenow")).toBe("1");
  });
});
