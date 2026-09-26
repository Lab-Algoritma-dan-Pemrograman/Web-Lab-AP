/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import JadwalSaya from "@/pages/JadwalSaya";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

const asPraktikan = () => vi.mocked(useAuth).mockReturnValue({
  user: { id: 1891, username: "202615001", full_name: "BARQY MUNAWWIR", role: "praktikan" },
  role: "praktikan",
  allowedPaths: [],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
} as any);

describe("JadwalSaya untuk praktikan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menampilkan jadwal, kontak asisten pembimbing, dan Kelompok Saya", async () => {
    asPraktikan();

    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === "get_personal_schedules_secure") {
        // Satu baris per jadwal, milik pemanggil sendiri
        return Promise.resolve({
          data: [{
            role: "praktikan", schedule_id: "35", schedule_title: "Dasar Pemrograman Komputer",
            schedule_day: "Kamis", schedule_start: "07:20:00", schedule_end: "09:50:00",
            schedule_major: "Teknik Sistem Energi", schedule_class: "C",
            student_id: 1891, student_name: "BARQY MUNAWWIR", student_nim: "202615001",
            student_shift: "1", assistant_id: 1859,
            assistant_name: "NAUFAL RAIHAN SAPUTRA", assistant_phone: "081282030818",
          }],
          error: null,
        }) as any;
      }
      if (fn === "get_system_settings_full_secure") return Promise.resolve({ data: [], error: null }) as any;
      if (fn === "get_group_members_secure") {
        // Kondisi setelah migration: hanya rekan satu asisten (1859), termasuk
        // baris pemanggil sendiri yang harus disaring UI.
        return Promise.resolve({
          data: [
            { id: 2059, student_id: 1891, assistant_id: 1859, student_name: "BARQY MUNAWWIR", student_nim: "202615001", student_shift: "1", student_class_code: "C", viewer_assistant_id: 1859 },
            { id: 2060, student_id: 1892, assistant_id: 1859, student_name: "KATARINA SHANEITTA", student_nim: "202615006", student_shift: "1", student_class_code: "C", viewer_assistant_id: 1859 },
          ],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(<MemoryRouter><JadwalSaya /></MemoryRouter>);

    expect(await screen.findByText("Dasar Pemrograman Komputer")).toBeInTheDocument();
    expect(screen.getByText("NAUFAL RAIHAN SAPUTRA")).toBeInTheDocument();
    expect(screen.getByText("Chat Asisten")).toBeInTheDocument();

    // RPC mengembalikan 2 baris (diri sendiri + 1 rekan); baris diri sendiri dibuang.
    expect(screen.getByText(/Kelompok Saya/)).toBeInTheDocument();
    expect(screen.queryByText(/Kelompok Bimbingan/)).not.toBeInTheDocument();
    expect(screen.getByText("1 orang")).toBeInTheDocument();
    expect(screen.queryByText("202615001")).not.toBeInTheDocument();
    expect(screen.getByText("202615006")).toBeInTheDocument();
    // Beberapa elemen boleh memuat nomor asisten (teks + href), jadi pakai getAllBy.
    expect(screen.getAllByText(/6281282030818/).length).toBeGreaterThan(0);
  });
});
