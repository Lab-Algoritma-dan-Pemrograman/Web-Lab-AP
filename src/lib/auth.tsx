import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LabUser {
  id: number;
  username: string;
  full_name: string;
  role: "praktikan" | "asisten" | "koordinator" | "penyewa";
  nim?: string;
  assistant_code?: string;
  division?: string;
}

interface AuthContextType {
  user: LabUser | null;
  role: string | null;
  allowedPaths: string[];
  loading: boolean;
  login: (userData: LabUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchAllowedPaths(userId: number, division: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_division_access_secure', {
    p_viewer_id: userId,
    p_division: division
  });
  if (data && !error) {
    return Array.isArray(data)
      ? data.map((d: any) => (typeof d === 'string' ? d : d.menu_key))
      : [];
  }
  return [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LabUser | null>(null);
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Kirim POST ke /api/auth/verify — server akan baca httpOnly cookie otomatis.
        // Jika cookie tidak ada, fallback ke localStorage token di Authorization header.
        const storedToken = localStorage.getItem("lab_jwt_token");
        const headers: Record<string, string> = {};
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const res = await fetch("/api/auth/verify", {
          method: "POST",
          credentials: "include", // kirim cookie httpOnly secara otomatis
          headers,
        });

        if (!res.ok) {
          console.warn("Session invalid or expired");
          localStorage.removeItem("lab_jwt_token");
          setUser(null);
          setLoading(false);
          return;
        }

        const resData = await res.json().catch(() => ({}));
        const dbUser = resData.user;

        if (dbUser) {
          const labUser: LabUser = {
            id: Number(dbUser.id),
            username: dbUser.username,
            full_name: dbUser.full_name,
            role: dbUser.role,
            nim: dbUser.nim || undefined,
            assistant_code: dbUser.assistant_code || undefined,
            division: dbUser.division || undefined,
          };

          setUser(labUser);

          if (labUser.role === 'asisten' && labUser.division) {
            const paths = await fetchAllowedPaths(labUser.id, labUser.division);
            setAllowedPaths(paths);
          }
        }
      } catch (error) {
        console.error("Gagal membaca sesi:", error);
        localStorage.removeItem("lab_jwt_token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (userData: LabUser, token: string) => {
    // Simpan di localStorage sebagai fallback (httpOnly cookie sudah di-set oleh server)
    localStorage.setItem("lab_jwt_token", token);
    setUser(userData);

    if (userData.role === 'asisten' && userData.division) {
      const paths = await fetchAllowedPaths(userData.id, userData.division);
      setAllowedPaths(paths);
    }
  };

  const logout = async () => {
    // Hapus token localStorage
    localStorage.removeItem("lab_jwt_token");
    setUser(null);
    setAllowedPaths([]);

    // Panggil server untuk menghapus httpOnly cookie (tidak bisa dihapus dari JS)
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Abaikan error — redirect tetap jalan
    }

    window.location.href = "/";
  };

  // AUTO LOGOUT (Inactivity Timer: 15 Minutes)
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT = 15 * 60 * 1000;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("Inactivity detected, logging out...");
        logout();
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role: user?.role || null, allowedPaths, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
