import { useState, useEffect } from "react";
import { 
  Home, BookOpen, PenTool, Calendar, Users, Settings, LogOut, 
  Box, FileText, User, CalendarCheck, CheckCircle, ClipboardCheck,
  MessageSquare, QrCode, CalendarDays 
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client"; 
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";

// --- DAFTAR MENU YANG DIBATASI (RESTRICTED) ---
const RESTRICTED_MENUS = [
  // "/absensi", 
  "/manajemen-user", 
  "/manajemen-jadwal",
  "/manajemen-kelas",
  "/validasi-absensi", 
  "/inventaris", 
  "/laporan-keuangan",
  "/penunjang-praktikum"
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State untuk menyimpan daftar menu yang diizinkan untuk divisi user ini
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  // State khusus untuk mengecek apakah asisten ini PJ Absen hari ini
  const [isPJAbsenToday, setIsPJAbsenToday] = useState(false);

  // --- CEK HAK AKSES DIVISI & STATUS PJ ABSEN ---
  useEffect(() => {
    const fetchAccessAndSchedule = async () => {
      if (user?.role !== 'asisten') return;

      try {
        // 1. Cek Hak Akses Divisi (seperti biasa)
        if (user.division) {
            const { data: divData } = await supabase
              .from('division_access')
              .select('menu_key')
              .eq('division', user.division);
            
            if (divData) {
              setAllowedPaths(divData.map(d => d.menu_key));
            }
        }

        // 2. Cek Status PJ Absen HARI INI
        const today = new Date().toLocaleDateString('en-CA'); // Format: YYYY-MM-DD sesuai zona waktu lokal
        const { data: pjData } = await supabase
            .from('schedule_assignments')
            .select('id')
            .eq('user_id', user.id)
            .eq('task_role', 'PJ Absen')
            .eq('activity_date', today)
            .eq('status', 'aktif')
            .limit(1);

        if (pjData && pjData.length > 0) {
            setIsPJAbsenToday(true);
        } else {
            setIsPJAbsenToday(false);
        }

      } catch (err) {
        console.error("Gagal load akses:", err);
      }
    };

    fetchAccessAndSchedule();
  }, [user]);

  // Definisi Menu Lengkap
  const menuItems = [
    // --- UMUM ---
    { title: "Beranda", url: "/beranda", icon: Home, roles: ["praktikan", "asisten", "koordinator"] },
    { title: "Profil Saya", url: "/profil", icon: User, roles: ["praktikan", "asisten", "koordinator"] },
    
    // --- FITUR UTAMA ---
    { title: "Absensi", url: "/absensi", icon: CalendarCheck, roles: ["praktikan", "asisten", "koordinator"] },
    { title: "Buat QR Absen", url: "/buat-qr", icon: QrCode, roles: ["asisten", "koordinator"] },

    // --- KRITIK SARAN ---
    { title: "Kritik & Saran", url: "/kritik-saran", icon: MessageSquare, roles: ["praktikan", "koordinator"] },

    // --- PRAKTIKAN ---
    { title: "Penunjang Praktikum", url: "/penunjang-praktikum", icon: BookOpen, roles: ["praktikan", "asisten","koordinator"] },

    // --- MANAJEMEN (ASISTEN & KOORDINATOR) ---
    { title: "Jadwal Saya", url: "/jadwal-saya", icon: Calendar, roles: ["praktikan","asisten","koordinator"] }, 
    { title: "Manajemen User", url: "/manajemen-user", icon: Users, roles: ["koordinator", "asisten"] },
    { title: "Manajemen Jadwal", url: "/manajemen-jadwal", icon: CalendarDays, roles: ["asisten", "koordinator"] },
    
    { title: "Validasi Absensi", url: "/validasi-absensi", icon: CheckCircle, roles: ["asisten", "koordinator"] },
    { title: "Jadwal Jaga", url: "/jadwal-jaga", icon: Calendar, roles: ["asisten", "koordinator"] },
    { title: "Inventaris", url: "/inventaris", icon: Box, roles: ["asisten", "koordinator"] },
    { title: "Pilih Asisten", url: "/manajemen-kelas", icon: Users, roles: ["koordinator", "asisten"] },
    { title: "Input Jadwal Free", url: "/ketersediaan", icon: CalendarCheck, roles: ["koordinator", "asisten"] },
    { title: "Laporan Keuangan", url: "/laporan-keuangan", icon: FileText, roles: ["koordinator","asisten"] },

    // --- ADMINISTRASI (KOORDINATOR ONLY) ---
    { title: "Pengaturan", url: "/pengaturan", icon: Settings, roles: ["koordinator"] },
  ];

  // --- FILTER MENU BERDASARKAN ROLE & DIVISI ---
  const filteredMenu = menuItems.filter((item) => {
    // 1. Filter Dasar: Cek Role User
    if (!user || !item.roles.includes(user.role)) return false;

    // 2. Koordinator Sakti: Bisa akses semua menu yang sesuai rolenya
    if (user.role === 'koordinator') return true;

    // 3. Praktikan: Bisa akses semua menu yang sesuai rolenya
    if (user.role === 'praktikan') return true;

    // 4. Asisten: Cek Hak Akses Divisi
    if (user.role === 'asisten') {
        
        // JALUR VIP: Jika dia adalah PJ Absen hari ini, PAKSA TAMPILKAN menu Absensi 
        // mengabaikan batasan divisi.
        if (item.url === '/absensi' && isPJAbsenToday) {
            return true;
        }

        // Jika menu ini ada dalam daftar "RESTRICTED", cek database permission divisi
        if (RESTRICTED_MENUS.includes(item.url)) {
            return allowedPaths.includes(item.url);
        }
        
        // Jika menu umum (Beranda, Profil, Modul), izinkan lewat
        return true; 
    }

    return false;
  });

  return (
    <Sidebar>
      <SidebarContent>
        <div className="p-4 font-bold text-xl text-primary flex items-center gap-2">
          <CalendarDays className="w-6 h-6"/> 
          <span className="truncate">Lab Algoritma</span>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenu.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url}
                    onClick={() => navigate(item.url)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      
                      {/* Opsional: Tambahkan indikator visual kalau ini akses khusus PJ Absen */}
                      {item.url === '/absensi' && isPJAbsenToday && !allowedPaths.includes('/absensi') && (
                          <span className="ml-auto text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Tugas</span>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="bg-muted/50 p-3 rounded-md mb-2 cursor-pointer hover:bg-muted transition-colors" onClick={() => navigate('/profil')}>
          <p className="text-sm font-bold truncate">{user?.full_name}</p>
          <div className="flex items-center justify-between mt-1">
             <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                <User className="w-3 h-3"/> {user?.role}
             </p>
             {user?.division && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{user.division}</span>}
          </div>
        </div>
        <SidebarMenuButton 
          onClick={logout} 
          className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Keluar
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}