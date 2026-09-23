import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { canonRole, roleAllowed } from "@/lib/roles";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requiredMenuKey?: string;
}

export default function ProtectedRoute({ children, allowedRoles, requiredMenuKey }: ProtectedRouteProps) {
  const { user, role, allowedPaths, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !roleAllowed(role, allowedRoles)) {
    return <Navigate to="/beranda" replace />;
  }

  // Cek Hak Akses Divisi (Khusus Asisten; admin/koordinator bypass)
  if (canonRole(role) === "asisten" && requiredMenuKey && !allowedPaths.includes(requiredMenuKey)) {
    return <Navigate to="/beranda" replace />;
  }

  return <>{children}</>;
}
