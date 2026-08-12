/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Pengaturan from "@/pages/Pengaturan";
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

describe("Pengaturan (Settings) Feature across Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render settings form for koordinator", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 3, username: "koordinator1", full_name: "Diana Koor", role: "koordinator" },
      role: "koordinator",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_system_settings_full_secure") {
        return Promise.resolve({
          data: [
            {
              id: 1,
              semester_active: "Ganjil 2026/2027",
              announcement: "Selamat datang praktikan baru!",
              is_recruitment_open: true,
              recruitment_link: "https://google.com/form",
              login_guide_text: "Masuk pakai NIM",
              procedure_text: [
                { step: "Daftar", desc: "Daftar akun" },
                { step: "Masuk", desc: "Login sistem" },
              ],
              reschedule_steps: "1. Izin\n2. Ganti",
              wa_templates: {
                absen_izin: "Izin kak",
                asisten_swap: "Swap kak",
                chat_asisten: "Chat kak",
              },
            },
          ],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <Pengaturan />
      </MemoryRouter>
    );

    // Verify page header
    expect(screen.getByText("Pengaturan Sistem")).toBeInTheDocument();

    // Verify card titles
    expect(screen.getByText("Konfigurasi Umum")).toBeInTheDocument();
    expect(screen.getByText("Panduan Login (Modal)")).toBeInTheDocument();

    // Verify fields populated
    expect(await screen.findByDisplayValue("Ganjil 2026/2027")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Selamat datang praktikan baru!")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://google.com/form")).toBeInTheDocument();
  });
});
