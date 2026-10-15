import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { AppShell } from "../../src/renderer/app/AppShell";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

// ZNAWCA-15 S4 自动验收（WORKBUDDY-TASKS.md §6，D-24 第三条）：
// Testing 显示进度单位总数/已完成/剩余。
// smokeCourse＝4 对象 × 2 个学习列（Scientific name、Diet）＝8 个进度单位。

async function beginTestingSession() {
  render(<AppShell />);
  fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
  fireEvent.click(screen.getByRole("button", { name: "Testing" }));
  fireEvent.click(screen.getByRole("button", { name: /Begin Testing/i }));
  await screen.findByText(/^Question 1 of \d+$/);
}

describe("D-24 testing progress unit display", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows total, completed and remaining units and updates after a submission", async () => {
    installSmokeCourse(defaultLocalState(), smokeCourse);
    await beginTestingSession();
    // 开始时尚无作答：0 / 8 已完成，8 剩余。
    expect(screen.getByText("0 / 8 units · 8 remaining")).toBeVisible();
    // 答一题（无论对错，该题覆盖的单位都计为完成）：1 / 8 已完成，剩余 7。
    const textbox = screen.queryByRole("textbox", { name: "Your answer" });
    if (textbox) fireEvent.change(textbox, { target: { value: "an answer" } });
    else {
      const fieldset = screen.getByRole("group", { name: "Your answer" });
      fireEvent.click(within(fieldset).getAllByRole("radio")[0]!);
    }
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText("1 / 8 units · 7 remaining")).toBeVisible();
  });

  // D-26：Learning 同样显示进度单位（已掌握/剩余），不再显示被问次数。
  it("shows mastered and remaining units during learning sessions", async () => {
    installSmokeCourse(defaultLocalState(), smokeCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    expect(await screen.findByText("0 / 8 mastered")).toBeVisible();
    expect(screen.getByText("0 / 8 units · 8 remaining")).toBeVisible();
    expect(screen.queryByText(/Question \d+ of \d+/)).toBeNull();
  });
});
