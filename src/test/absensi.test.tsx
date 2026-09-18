/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Absensi from "@/pages/Absensi";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

// Mock html5-qrcode
vi.mock("html5-qrcode", () => {
  return {
    Html5Qrcode: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(null),
      stop: vi.fn().mockResolvedValue(null),
      isScanning: false,
    })),
  };
});

describe("Absensi (Attendance) Feature across Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render scan and izin tabs for praktikan", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 10, username: "123456", full_name: "Budi Santoso", role: "mahasiswa" },
      role: "mahasiswa",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_attendance_logs_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_schedules_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_personal_schedules_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_smart_validation_contact_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_system_settings_full_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <Absensi />
      </MemoryRouter>
    );

    // Verify tabs are present
    expect(screen.getByText("Scan QR")).toBeInTheDocument();
    expect(screen.getByText("Izin")).toBeInTheDocument();
    expect(screen.getByText("Alur Ganti Jadwal (Reschedule)")).toBeInTheDocument();
  });

  it("should render manual attendance inputs for asisten (staff)", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 20, username: "asisten1", full_name: "Ali Asisten", role: "asisten", division: "Software" },
      role: "asisten",
      allowedPaths: ["/absensi", "/validasi-absensi"],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "check_menu_access_secure") {
        return Promise.resolve({ data: true, error: null }) as any;
      }
      if (rpcName === "is_pj_absen_today") {
        return Promise.resolve({ data: false, error: null }) as any;
      }
      if (rpcName === "get_attendance_logs_secure") {
        return Promise.resolve({
          data: [
            {
              id: 1,
              check_in_time: new Date().toISOString(),
              status: "Hadir",
              user_full_name: "Budi Santoso",
              user_username: "123456",
              user_role: "mahasiswa",
            },
          ],
          error: null,
        }) as any;
      }
      if (rpcName === "get_schedules_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_deletion_history_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_system_settings_full_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <Absensi />
      </MemoryRouter>
    );

    // Verify manual help form is present for staff
    expect(screen.getByText("Bantu Absen Manual")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Masukkan NIM...")).toBeInTheDocument();
    expect(screen.getByText("Simpan Kehadiran")).toBeInTheDocument();

    // Verify table lists the students
    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("123456")).toBeInTheDocument();
  });
});
