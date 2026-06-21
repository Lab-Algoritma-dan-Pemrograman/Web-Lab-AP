import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// 1. Definisikan bentuk User sesuai database kita
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
    // 2. Saat website dibuka, cek apakah ada data login tersimpan?
    const checkSession = async () => {
      try {
        const token = localStorage.getItem("lab_jwt_token");
        if (token) {
          // Verifikasi token melalui endpoint serverless
          const res = await fetch("/api/auth/verify", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });

          if (!res.ok) {
            console.warn("Session invalid or expired");
            localStorage.removeItem("lab_jwt_token");
            setUser(null);
            setLoading(false);
            return;
          }

          const resData = await res.json();
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

  // 3. Fungsi Login (Dipanggil dari halaman Login)
  const login = async (userData: LabUser, token: string) => {
    localStorage.setItem("lab_jwt_token", token);
    setUser(userData);
    
    if (userData.role === 'asisten' && userData.division) {
      const paths = await fetchAllowedPaths(userData.id, userData.division);
      setAllowedPaths(paths);
    }
  };

  // 4. Fungsi Logout
  const logout = () => {
    localStorage.removeItem("lab_jwt_token");
    setUser(null);
    window.location.href = "/"; // Refresh ke halaman login
  };

  // 5. AUTO LOGOUT (Inactivity Timer: 15 Minutes)
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 Menit

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("Inactivity detected, logging out...");
        logout();
      }, INACTIVITY_LIMIT);
    };

    // Event listeners untuk mendeteksi aktivitas
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Inisialisasi timer pertama kali
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        role: user?.role || null, 
        allowedPaths,
        loading, 
        login, 
        logout 
      }}
    >
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