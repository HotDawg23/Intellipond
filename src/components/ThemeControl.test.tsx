import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "@/components/ThemeControl";

const themeMocks = vi.hoisted(() => ({
  theme: "system" as string,
  resolvedTheme: "dark" as string,
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeMocks,
}));

describe("ThemeControl", () => {
  beforeEach(() => {
    themeMocks.theme = "system";
    themeMocks.resolvedTheme = "dark";
    themeMocks.setTheme.mockClear();
  });

  it("toggles from the resolved dark theme to light mode", () => {
    render(<ThemeControl iconOnly />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(themeMocks.setTheme).toHaveBeenCalledWith("light");
  });
});
