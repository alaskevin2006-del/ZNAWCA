import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../../src/renderer/app-shell/AppShell";

describe("AppShell", () => {
  it("renders the offline desktop foundation without a preload bridge", () => {
    render(<AppShell />);
    expect(screen.getByText("Znawca")).toBeVisible();
    expect(screen.getByText("Choose what to master")).toBeVisible();
  });
});
