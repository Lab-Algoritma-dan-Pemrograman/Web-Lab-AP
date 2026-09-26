/* eslint-disable @typescript-eslint/no-explicit-any */
// Halaman Manajemen User harus selalu punya tombol Edit & Hapus untuk koordinator.
// Isu yang dikunci: kolom "Aksi" pernah terlihat kosong karena tombol dirender
// kondisional (canEdit / perbandingan role), bukan karena kolomnya hilang.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ManajemenUser from "@/pages/ManajemenUser";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

const withIcon = (cls: string) =>
  screen.getAllByRole("button").filter(b => b.innerHTML.includes(cls));
const editButtons = () => withIcon("text-blue-500");
const deleteButtons = () => withIcon("text-red-500");

const USERS = [
  { id: 10, username: "202414001", full_name: "Budi Praktikan", role: "praktikan", nim: "202414001", class_code: "IF-A", shift: "1", is_active: true },
  { id: 20, username: "asisten1", full_name: "Ali Asisten", role: "asisten", assistant_code: "AL", division: "Software", is_active: true },
];

function asUser(role: string, id = 3) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id, username: `${role}1`, full_name: "Test User", role },
    role, allowedPaths: [], loading: false, login: vi.fn(), logout: vi.fn(),
  } as any);
}

function mockRpc() {
  vi.mocked(supabase.rpc).mockImplementation((name: string) => {
    if (name === "get_users_secure") return Promise.resolve({ data: USERS, error: null }) as any;
    if (name === "get_system_settings_secure") return Promise.resolve({ data: [{ active_shift: "all" }], error: null }) as any;
    return Promise.resolve({ data: null, error: null }) as any;
  });
}

describe("Manajemen User - kolom Aksi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menampilkan kolom Aksi beserta tombol Edit & Hapus untuk koordinator", async () => {
    asUser("koordinator");
    mockRpc();
    render(<MemoryRouter><ManajemenUser /></MemoryRouter>);

    expect(await screen.findByText("Budi Praktikan")).toBeInTheDocument();
    expect(screen.getByText("Aksi")).toBeInTheDocument();

    // 2 baris x (Edit + Hapus). Warna ada di ikon di dalam tombol, bukan di
    // tombolnya, jadi hitung lewat innerHTML. Kalau tombolnya berhenti dirender
    // (kondisi canEdit salah), test ini merah walau kolom "Aksi" masih ada.
    expect(editButtons()).toHaveLength(2);
    expect(deleteButtons()).toHaveLength(2);
  });

  it("asisten hanya boleh mengedit dirinya sendiri dan praktikan", async () => {
    asUser("asisten", 20);
    mockRpc();
    render(<MemoryRouter><ManajemenUser /></MemoryRouter>);

    expect(await screen.findByText("Ali Asisten")).toBeInTheDocument();

    // canEdit: baris dirinya (id 20) + praktikan (id 10) -> 2 tombol Edit;
    // Hapus hanya untuk koordinator -> 0.
    expect(editButtons()).toHaveLength(2);
    expect(deleteButtons()).toHaveLength(0);
  });
});
