import { waitFor, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { AppShell } from "../../src/renderer/app/AppShell";

afterEach(() => {
  document.documentElement.lang = "";
  document.documentElement.dir = "";
});

describe("language settings", () => {
  it("persists Arabic and applies RTL immediately", async () => {
    const saveLocalState = vi.fn().mockResolvedValue(undefined);
    window.znawca = {
      chooseCourse: vi.fn(), loadLocalState: vi.fn().mockResolvedValue(defaultLocalState()), saveLocalState,
    };
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Interface language"), { target: { value: "ar" } });
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("اختر ما تريد إتقانه")).toBeVisible();
    await waitFor(() => expect(saveLocalState).toHaveBeenCalledWith(expect.objectContaining({ settings: expect.objectContaining({ locale: "ar" }) })));
  });
});
