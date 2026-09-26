/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ManajemenUser from "@/pages/ManajemenUser";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

describe("Manajemen (Management) Page across Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render users table for koordinator", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 3, username: "koordinator1", full_name: "Diana Koor", role: "koordinator" },
      role: "koordinator",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_users_secure") {
        return Promise.resolve({
          data: [
            {
              id: 10,
              username: "202414001",
              full_name: "Budi Praktikan",
              role: "praktikan",
              nim: "202414001",
              class_code: "IF-A",
              shift: "1",
              is_active: true,
            },
            {
              id: 20,
              username: "asisten1",
              full_name: "Ali Asisten",
              role: "asisten",
              assistant_code: "AL",
              division: "Software",
              is_active: true,
            },
          ],
          error: null,
        }) as any;
      }
      if (rpcName === "get_system_settings_secure") {
        return Promise.resolve({ data: [{ active_shift: "all" }], error: null }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <ManajemenUser />
      </MemoryRouter>
    );

    // Verify header title and description
    expect(screen.getByText("Manajemen User")).toBeInTheDocument();
    expect(screen.getByText("Kelola akun, shift, dan hak akses divisi.")).toBeInTheDocument();

    // Verify search input
    expect(screen.getByPlaceholderText("Cari Nama, NIM, No HP, Kelas...")).toBeInTheDocument();

    // Verify users are listed in the table
    expect(await screen.findByText("Budi Praktikan")).toBeInTheDocument();
    expect(screen.getByText("202414001")).toBeInTheDocument();
    expect(screen.getByText("Ali Asisten")).toBeInTheDocument();
    expect(screen.getByText("asisten1")).toBeInTheDocument();
  });
});
