/* eslint-disable @typescript-eslint/no-explicit-any */
// E-Learning harus bisa diakses SEMUA asisten, apa pun divisinya.
// Sebelumnya /e-learning ikut dibatasi division_access (RESTRICTED_MENUS +
// requiredMenuKey), sehingga hanya asisten divisi K3/PDD/PENDIDIKAN yang bisa
// membuka; divisi lain dilempar ke /beranda.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { ALWAYS_ALLOWED_MENUS } from "@/lib/roles";

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

function asAsisten(allowedPaths: string[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 5, username: "asisten1", full_name: "Asisten Uji", role: "asisten" },
    role: "asisten",
    allowedPaths,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  } as any);
}

function renderRoute(menuKey: string) {
  return render(
    <MemoryRouter initialEntries={["/uji"]}>
      <Routes>
        <Route path="/beranda" element={<div>BERANDA</div>} />
        <Route
          path="/uji"
          element={<ProtectedRoute requiredMenuKey={menuKey}><div>HALAMAN TERBUKA</div></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute untuk asisten", () => {
  it("/e-learning terbuka walau divisi tidak punya menu itu", () => {
    asAsisten([]); // divisi tanpa hak akses apa pun
    renderRoute("/e-learning");
    expect(screen.getByText("HALAMAN TERBUKA")).toBeInTheDocument();
    expect(screen.queryByText("BERANDA")).not.toBeInTheDocument();
  });

  it("menu terbatas lain tetap diblokir tanpa hak akses divisi", () => {
    asAsisten([]);
    renderRoute("/laporan-keuangan");
    expect(screen.getByText("BERANDA")).toBeInTheDocument();
    expect(screen.queryByText("HALAMAN TERBUKA")).not.toBeInTheDocument();
  });

  it("menu terbatas terbuka bila divisi memang punya haknya", () => {
    asAsisten(["/laporan-keuangan"]);
    renderRoute("/laporan-keuangan");
    expect(screen.getByText("HALAMAN TERBUKA")).toBeInTheDocument();
  });

  it("daftar pengecualian memuat alat kerja dasar asisten", () => {
    expect(ALWAYS_ALLOWED_MENUS).toEqual(expect.arrayContaining(["/absensi", "/buat-qr", "/e-learning"]));
  });
});
