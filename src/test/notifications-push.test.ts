/* eslint-disable @typescript-eslint/no-explicit-any */
// Mengunci jalur RPC notifikasi Web Push: akses tabel langsung selalu 401 di
// produksi (role anon tak diberi GRANT), jadi simpan/hapus langganan WAJIB
// lewat proxy RPC yang menyuntik p_caller_id dari JWT.
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpc(...args),
    // Akses tabel langsung sengaja dibuat meledak: kalau kode kembali memakainya,
    // test ini gagal alih-alih gagal senyap di produksi.
    from: (table: string) => {
      throw new Error(`akses tabel langsung tidak diizinkan: ${table}`);
    },
  },
}));

vi.mock("./quotes", () => ({ getDailyQuote: () => ({ quote: "x", author: "y" }) }));

import { unsubscribeWebPush } from "@/lib/notifications";

const unsubscribe = vi.fn().mockResolvedValue(true);

function mockServiceWorker(sub: any) {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => sub } }) },
  });
}

describe("unsubscribeWebPush", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
    unsubscribe.mockClear();
  });

  it("menghapus langganan lewat RPC dengan p_caller_id milik pemanggil", async () => {
    mockServiceWorker({ endpoint: "https://fcm.example/abc", unsubscribe });

    await unsubscribeWebPush({ id: 1891 });

    expect(rpc).toHaveBeenCalledWith("delete_push_subscription_secure", {
      p_caller_id: 1891,
      p_endpoint: "https://fcm.example/abc",
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("tidak memanggil RPC bila user tidak dikenali (logout tanpa sesi)", async () => {
    mockServiceWorker({ endpoint: "https://fcm.example/abc", unsubscribe });

    await unsubscribeWebPush(undefined);

    expect(rpc).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
