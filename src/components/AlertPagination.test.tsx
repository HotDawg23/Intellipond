import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlertPagination from "@/components/AlertPagination";

describe("alert pagination", () => {
  it("hides controls for one page or an empty view", () => {
    const { rerender } = render(<AlertPagination page={0} total={0} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: "Alert pages" })).toBeNull();
    rerender(<AlertPagination page={0} total={30} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: "Alert pages" })).toBeNull();
  });

  it("shows the correct page range and enables only valid navigation", () => {
    const changePage = vi.fn();
    const { rerender } = render(<AlertPagination page={0} total={31} onPageChange={changePage} />);
    expect(screen.getByText("Showing 1–30 of 31")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous alert page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next alert page" }));
    expect(changePage).toHaveBeenCalledWith(1);
    rerender(<AlertPagination page={1} total={31} onPageChange={changePage} />);
    expect(screen.getByText("Showing 31–31 of 31")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next alert page" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
