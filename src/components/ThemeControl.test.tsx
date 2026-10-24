import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "@/components/ThemeControl";

const themeMocks = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: themeMocks.setTheme }),
}));

describe("ThemeControl", () => {
  beforeEach(() => themeMocks.setTheme.mockClear());

  it("lets keyboard users open the appearance menu and select a theme", () => {
    render(<ThemeControl iconOnly />);

    const trigger = screen.getByRole("button", { name: "Change appearance" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });

    const darkOption = screen.getByRole("menuitemradio", { name: "Dark" });
    fireEvent.click(darkOption);

    expect(themeMocks.setTheme).toHaveBeenCalledWith("dark");
  });
});
