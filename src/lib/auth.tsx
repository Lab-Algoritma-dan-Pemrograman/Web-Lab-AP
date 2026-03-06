import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// 1. Definisikan bentuk User sesuai database kita
export interface LabUser {
  id: number;
  username: string;
  full_name: string;
  role: "praktikan" | "asisten" | "koordinator";
  nim?: string;
  assistant_code?: string;
}

interface AuthContextType {
  user: LabUser | null;
  role: string | null;
  loading: boolean;
  login: (userData: LabUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LabUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 2. Saat website dibuka, cek apakah ada data login tersimpan?
    const checkSession = () => {
      try {
        const storedSession = localStorage.getItem("lab_session");
        if (storedSession) {
          const parsedUser = JSON.parse(storedSession);
          setUser(parsedUser);
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
  const login = (userData: LabUser) => {
    localStorage.setItem("lab_session", JSON.stringify(userData));
    setUser(userData);
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