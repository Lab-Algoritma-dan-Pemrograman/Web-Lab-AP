import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// --- IMPORT SEMUA HALAMAN ---
import Login from "./pages/Login";
import Beranda from "./pages/Beranda";
import UploadLaporan from "./pages/UploadLaporan";
import NotFound from "./pages/NotFound";
import ManajemenUser from "./pages/ManajemenUser";
import Profil from "./pages/Profil";
import PenunjangPraktikum from "./pages/PenunjangPraktikum";           
import Absensi from "./pages/Absensi";
import KritikSaran from "./pages/KritikSaran";
import BuatQR from "./pages/BuatQR";
import ManajemenJadwal from "./pages/ManajemenJadwal";
import ManajemenKelas from "./pages/ManajemenKelas";
import KetersediaanAsisten from "./pages/KetersediaanAsisten";


// Tahap 1
import ValidasiAbsensi from "./pages/ValidasiAbsensi";
import Inventaris from "./pages/Inventaris";
import JadwalSaya from "./pages/JadwalSaya";
import JadwalJaga from "./pages/JadwalJaga";
// Tahap Akhir
import LaporanKeuangan from "./pages/LaporanKeuangan";
import ELearning from "./pages/ELearning";

import Pengaturan from "./pages/Pengaturan";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;
  if (user) return <Navigate to="/beranda" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/beranda" element={<ProtectedRoute><Beranda /></ProtectedRoute>} />
      
      {/* PRAKTIKAN */}
      <Route path="/upload-laporan" element={<ProtectedRoute allowedRoles={["praktikan"]}><UploadLaporan /></ProtectedRoute>} />
      <Route path="/e-learning" element={<ProtectedRoute requiredMenuKey="/e-learning"><ELearning /></ProtectedRoute>} />

      {/* UMUM (Semua User Login) */}
      <Route path="/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />
      <Route path="/absensi" element={<ProtectedRoute><Absensi /></ProtectedRoute>} />
      
      {/* KRITIK SARAN: Diakses Praktikan (Kirim) & Koordinator (Baca) */}
      <Route path="/kritik-saran" element={<ProtectedRoute allowedRoles={["praktikan", "koordinator"]}><KritikSaran /></ProtectedRoute>} />

      {/* ASISTEN & KOORDINATOR */}
      <Route path="/jadwal-saya" element={<ProtectedRoute allowedRoles={["asisten","praktikan","koordinator"]}><JadwalSaya /></ProtectedRoute>} />
      <Route path="/penunjang-praktikum" element={<ProtectedRoute allowedRoles={["asisten","praktikan","koordinator"]} requiredMenuKey="/penunjang-praktikum"><PenunjangPraktikum /></ProtectedRoute>} />

      <Route path="/manajemen-user" element={<ProtectedRoute allowedRoles={["koordinator","asisten"]} requiredMenuKey="/manajemen-user"><ManajemenUser /></ProtectedRoute>} />
      <Route path="/validasi-absensi" element={<ProtectedRoute allowedRoles={["asisten", "koordinator"]} requiredMenuKey="/validasi-absensi"><ValidasiAbsensi /></ProtectedRoute>} />
      <Route path="/jadwal-jaga" element={<ProtectedRoute allowedRoles={["asisten", "koordinator"]}><JadwalJaga /></ProtectedRoute>} />
      <Route path="/inventaris" element={<ProtectedRoute allowedRoles={["asisten", "koordinator"]} requiredMenuKey="/inventaris"><Inventaris /></ProtectedRoute>} />
      <Route path="/buat-qr" element={<ProtectedRoute allowedRoles={["asisten", "koordinator"]} requiredMenuKey="/buat-qr"><BuatQR /></ProtectedRoute>} />
      <Route path="/manajemen-jadwal" element={<ProtectedRoute allowedRoles={["asisten", "koordinator"]} requiredMenuKey="/manajemen-jadwal"><ManajemenJadwal /></ProtectedRoute>} />
      <Route path="/manajemen-kelas" element={<ProtectedRoute allowedRoles={["koordinator", "asisten"]} requiredMenuKey="/manajemen-kelas"><ManajemenKelas /></ProtectedRoute>} />
      <Route path="/ketersediaan" element={<ProtectedRoute allowedRoles={["koordinator", "asisten"]} requiredMenuKey="/ketersediaan"><KetersediaanAsisten /></ProtectedRoute>} />
      <Route path="/laporan-keuangan" element={<ProtectedRoute allowedRoles={["koordinator","asisten"]} requiredMenuKey="/laporan-keuangan"><LaporanKeuangan /></ProtectedRoute>} />
      
      {/* KHUSUS KOORDINATOR (ADMINISTRASI) */}
      <Route path="/pengaturan" element={<ProtectedRoute allowedRoles={["koordinator"]}><Pengaturan /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;