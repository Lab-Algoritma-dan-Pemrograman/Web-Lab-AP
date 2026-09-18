/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SewaBarang from "@/pages/SewaBarang";
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

describe("Inventaris & Sewa Barang (Rent Items) Feature across Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render rental catalog and personal request lists", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 10, username: "praktikan1", full_name: "Budi Praktikan", role: "mahasiswa" },
      role: "mahasiswa",
      allowedPaths: [],
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === "get_renter_items_secure") {
        return Promise.resolve({
          data: [
            { id: 1, name: "Arduino Uno", location: "Rak A", condition: "Baik", quantity: 5, price_per_day: 0 },
            { id: 2, name: "Solder Listrik", location: "Rak B", condition: "Baik", quantity: 2, price_per_day: 5000 },
          ],
          error: null,
        }) as any;
      }
      if (rpcName === "get_my_rentals_secure") {
        return Promise.resolve({
          data: [
            {
              id: 101,
              item_name: "Arduino Uno",
              quantity: 1,
              start_date: new Date().toISOString(),
              end_date: new Date().toISOString(),
              type: "pinjam",
              status: "pending",
              total_price: 0,
            },
          ],
          error: null,
        }) as any;
      }
      if (rpcName === "get_smart_validation_contact_secure") {
        return Promise.resolve({ data: [{ phone_number: "08123456789" }], error: null }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    render(
      <MemoryRouter>
        <SewaBarang />
      </MemoryRouter>
    );

    // Verify header title
    expect(screen.getByText("Katalog Sewa & Pinjam")).toBeInTheDocument();

    // Verify catalog items are loaded and rendered
    const items = await screen.findAllByText("Arduino Uno");
    expect(items).toHaveLength(2);
    expect(screen.getByText("5 Unit")).toBeInTheDocument();
    expect(screen.getByText("Solder Listrik")).toBeInTheDocument();
    expect(screen.getByText("Rp 5.000")).toBeInTheDocument();

    // Verify personal request is listed
    expect(screen.getByText("Pengajuan Saya")).toBeInTheDocument();
    expect(screen.getByText("Verifikasi KTM (WA)")).toBeInTheDocument();
  });
});
