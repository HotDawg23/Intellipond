import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InitialPassword from "@/pages/InitialPassword";

const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  refreshAccess: vi.fn(),
  changeRequired: true,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: state.invoke } } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "operator-1" }, loading: false,
    mustChangePassword: state.changeRequired,
    refreshAccess: state.refreshAccess, signOut: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const renderPage = () => render(
  <MemoryRouter initialEntries={["/initial-password"]}>
    <Routes>
      <Route path="/initial-password" element={<InitialPassword />} />
      <Route path="/dashboard" element={<div>Dashboard opened</div>} />
    </Routes>
  </MemoryRouter>,
);

describe("initial password setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.changeRequired = true;
    state.invoke.mockResolvedValue({ error: null });
    state.refreshAccess.mockImplementation(async () => { state.changeRequired = false; });
  });

  it("requires matching passwords before submitting", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it("updates the password and opens the dashboard", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    await waitFor(() => expect(state.invoke).toHaveBeenCalledWith("change-initial-password", { body: { password: "new-password-123" } }));
    expect(await screen.findByText("Dashboard opened")).toBeVisible();
  });
});
