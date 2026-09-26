/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Beranda from "@/pages/Beranda";
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

describe("Beranda (Dashboard) Feature across Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render PraktikanDashboard when role is 'praktikan'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: "praktikan1", full_name: "Budi Praktikan", role: "praktikan" },
      role: "praktikan",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_dashboard_stats_secure") {
        return Promise.resolve({ data: { total_kelas: 3, attendance_rate: 95, total_feedback: 1 }, error: null }) as any;
      }
      if (rpcName === "get_attendance_logs_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      if (rpcName === "get_personal_schedules_secure" || rpcName === "get_system_settings_full_secure") {
        return Promise.resolve({ data: [], error: null }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <Beranda />
      </MemoryRouter>
    );

    expect(await screen.findByText("Selamat Datang, Budi Praktikan!")).toBeInTheDocument();
    expect(screen.getByText("Kehadiran")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("Kelas Diambil")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should render AsistenDashboard when role is 'asisten'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 2, username: "asisten1", full_name: "Ali Asisten", role: "asisten" },
      role: "asisten",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_dashboard_stats_secure") {
        return Promise.resolve({
          data: {
            total_students_under_me: 25,
            total_classes_under_me: 4,
            my_attendance_count: 10,
            upcoming_shifts_count: 2,
          },
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <Beranda />
      </MemoryRouter>
    );

    expect(await screen.findByText("Dashboard Asisten")).toBeInTheDocument();
    expect(screen.getByText("Jadwal Jaga")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Praktikan")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("should render KoordinatorDashboard when role is 'koordinator'", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 3, username: "koordinator1", full_name: "Diana Koordinator", role: "koordinator" },
      role: "koordinator",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_dashboard_stats_secure") {
        return Promise.resolve({
          data: {
            total_users: 150,
            total_assistants: 12,
            total_students: 130,
            total_feedback: 5,
            upcoming_shifts_count: 8,
            total_classes_under_me: 10,
            total_students_under_me: 50,
            pending_attendance: 3,
            pending_assistant_requests: 2,
          },
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <Beranda />
      </MemoryRouter>
    );

    expect(await screen.findByText("Pusat Kendali Koordinator")).toBeInTheDocument();
    expect(screen.getByText("Total Pengguna")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("Approval Absen")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Approval Izin")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
