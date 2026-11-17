import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Users from "@/pages/admin/Users";

const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  update: vi.fn(),
  profiles: [] as Record<string, unknown>[],
}));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: state.invoke },
    from: (table: string) => {
      const query = {
        select: () => query,
        order: () => query,
        update: (values: Record<string, unknown>) => { state.update(values); return query; },
        eq: () => query,
        single: async () => ({ data: { id: "profile-1" }, error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: table === "profiles" ? state.profiles : [], error: null }),
      };
      return query;
    },
  },
}));

describe("admin operator creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.profiles = [];
    state.invoke.mockResolvedValue({ error: null });
  });

  it("submits a new account and closes the form", async () => {
    render(<MemoryRouter><Users /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Create operator" }));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Middle name (optional)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Operator" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "initial-pass-123" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create operator" }));
    await waitFor(() => expect(state.invoke).toHaveBeenCalledWith("create-operator", {
      body: { firstName: "Alex", middleName: "", lastName: "Operator", email: "alex@example.com", password: "initial-pass-123" },
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("lets an admin review an existing name without changing the account", async () => {
    state.profiles = [{ id: "profile-1", full_name: "Legacy Name", first_name: null,
      middle_name: null, last_name: null, email: "legacy@example.com", approved: true }];
    render(<MemoryRouter><Users /></MemoryRouter>);
    expect(await screen.findByText("Legacy Name")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit name" }));
    expect(screen.getByText(/Previous full name:/)).toHaveTextContent("Legacy Name");
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Middle name (optional)"), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Santos" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith(expect.objectContaining({
      first_name: "Ana", middle_name: "Maria", last_name: "Santos", full_name: null,
    })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
