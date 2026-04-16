import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// 1. Definisikan bentuk User sesuai database kita
export interface LabUser {
  id: number;
  username: string;
  full_name: string;
  role: "praktikan" | "asisten" | "koordinator";
  nim?: string;
  assistant_code?: string;
  division?: string;
}

interface AuthContextType {
  user: LabUser | null;
  role: string | null;
  allowedPaths: string[];
  loading: boolean;
  login: (userData: LabUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LabUser | null>(null);
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 2. Saat website dibuka, cek apakah ada data login tersimpan?
    const checkSession = async () => {
      try {
        const storedSession = localStorage.getItem("lab_session");
        if (storedSession) {
          const parsedUser = JSON.parse(storedSession) as LabUser;

          // === SERVER-SIDE ROLE VERIFICATION ===
          // Re-query database menggunakan RPC yang aman agar RLS tidak dilewati.
          const { data, error } = await supabase
            .rpc("get_user_profile", { 
              p_target_id: parsedUser.id 
            });

          const dbUser = Array.isArray(data) ? data[0] : data;

          if (error || !dbUser) {
            // User tidak ditemukan di database → session tidak valid
            console.warn("Session invalid: user not found in database");
            localStorage.removeItem("lab_session");
            setUser(null);
          } else if (dbUser.role !== parsedUser.role) {
            // Role di localStorage berbeda dengan database → ada manipulasi!
            console.warn(
              `Role mismatch! localStorage: ${parsedUser.role}, DB: ${dbUser.role}. Correcting...`
            );
            // Koreksi ke role yang benar dari database
            const correctedUser: LabUser = {
              id: dbUser.id,
              username: dbUser.username,
              full_name: dbUser.full_name,
              role: dbUser.role,
              nim: dbUser.nim || undefined,
              assistant_code: dbUser.assistant_code || undefined,
              division: dbUser.division || undefined,
            };
            localStorage.setItem("lab_session", JSON.stringify(correctedUser));
            setUser(correctedUser);
          } else {
            // Role cocok → session valid
            setUser({ 
              ...parsedUser, 
              division: dbUser.division || undefined 
            });
            if (dbUser.role === 'asisten' && dbUser.division) {
              const { data: divData } = await supabase
                .from('division_access')
                .select('menu_key')
                .eq('division', dbUser.division);
              if (divData) {
                setAllowedPaths(divData.map(d => d.menu_key));
              }
            }
          }
        }
      } catch (error) {
        console.error("Gagal membaca sesi:", error);
        localStorage.removeItem("lab_session");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // 3. Fungsi Login (Dipanggil dari halaman Login)
  const login = async (userData: LabUser) => {
    localStorage.setItem("lab_session", JSON.stringify(userData));
    setUser(userData);
    
    if (userData.role === 'asisten' && (userData as any).division) {
       const { data: divData } = await supabase
         .from('division_access')
         .select('menu_key')
         .eq('division', (userData as any).division);
       if (divData) setAllowedPaths(divData.map((d: any) => d.menu_key));
    }
  };

  // 4. Fungsi Logout
  const logout = () => {
    localStorage.removeItem("lab_session");
    setUser(null);
    window.location.href = "/"; // Refresh ke halaman login
  };

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