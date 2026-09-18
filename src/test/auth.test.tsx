import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(),
}));

describe("Authentication & RBAC (Role-Based Access Control)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loader when authentication is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      role: null,
      allowedPaths: [],
      loading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText("Memuat...")).toBeInTheDocument();
  });

  it("should redirect to '/' if user is not authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      role: null,
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should render children if user has the allowed role", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: "praktikan1", full_name: "Praktikan Satu", role: "mahasiswa" },
      role: "mahasiswa",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/beranda" element={<div>Beranda</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={["mahasiswa"]}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("should redirect to '/beranda' if user role is not allowed", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: "praktikan1", full_name: "Praktikan Satu", role: "mahasiswa" },
      role: "mahasiswa",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/beranda" element={<div>Beranda Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={["asisten"]}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Beranda Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should redirect to '/beranda' if assistant does not have required menu key", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 2, username: "asisten1", full_name: "Asisten Satu", role: "asisten", division: "Software" },
      role: "asisten",
      allowedPaths: ["/jadwal-jaga"],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/beranda" element={<div>Beranda Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={["asisten"]} requiredMenuKey="/manajemen-user">
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Beranda Page")).toBeInTheDocument();
  });

  it("should allow access if assistant has required menu key", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 2, username: "asisten1", full_name: "Asisten Satu", role: "asisten", division: "Software" },
      role: "asisten",
      allowedPaths: ["/manajemen-user"],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/beranda" element={<div>Beranda Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={["asisten"]} requiredMenuKey="/manajemen-user">
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
