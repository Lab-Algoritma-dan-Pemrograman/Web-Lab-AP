import { useState, useEffect } from "react";
import { 
  Home, BookOpen, PenTool, Calendar, Users, Settings, LogOut, 
  Box, FileText, User, CalendarCheck, CheckCircle, ClipboardCheck,
  MessageSquare, QrCode, CalendarDays, GraduationCap, PackageSearch, ListChecks
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client"; 
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  "/manajemen-user", 
  "/manajemen-jadwal",
  "/manajemen-kelas",
  "/validasi-absensi", 
  "/inventaris", 
  "/laporan-keuangan",
  "/penunjang-praktikum",
  "/e-learning",
  "/ketersediaan",
  "/manajemen-sewa"
];

export function AppSidebar() {
  const { user, logout, allowedPaths } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isPJAbsenToday, setIsPJAbsenToday] = useState(false);

  // --- FITUR INGAT POSISI SCROLL ---
  useEffect(() => {
    // Saat sidebar dimuat, ambil posisi scroll terakhir dari memori browser
    const savedScroll = sessionStorage.getItem("sidebarScrollPos");
    const scrollContainer = document.getElementById("sidebar-scroll-area");
    
    if (scrollContainer && savedScroll) {
      scrollContainer.scrollTop = parseInt(savedScroll, 10);
    }
  }, [location.pathname]); // Jalankan setiap kali URL berubah

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Simpan posisi scroll ke memori browser setiap kali user melakukan scroll
    sessionStorage.setItem("sidebarScrollPos", e.currentTarget.scrollTop.toString());
  };

  // --- CEK STATUS PJ ABSEN ---
  useEffect(() => {
    const fetchPJStatus = async () => {
      if (user?.role !== 'asisten') return;

      try {
        const today = new Date().toLocaleDateString('en-CA'); 
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
        console.error("Gagal load PJ status:", err);
      }
    };

    fetchPJStatus();
  }, [user]);

  // Definisi Menu Lengkap
  const menuItems = [
    { title: "Beranda", url: "/beranda", icon: Home, roles: ["praktikan", "asisten", "koordinator", "penyewa"] },
    { title: "Profil Saya", url: "/profil", icon: User, roles: ["praktikan", "asisten", "koordinator", "penyewa"] },
    
    { title: "Sewa & Pinjam", url: "/sewa-barang", icon: PackageSearch, roles: ["penyewa"] },
    { title: "Manajemen Sewa", url: "/manajemen-sewa", icon: ListChecks, roles: ["asisten", "koordinator"] },

    { title: "Absensi", url: "/absensi", icon: CalendarCheck, roles: ["praktikan", "asisten", "koordinator"] },
    { title: "Buat QR Absen", url: "/buat-qr", icon: QrCode, roles: ["asisten", "koordinator"] },
    { title: "Kritik & Saran", url: "/kritik-saran", icon: MessageSquare, roles: ["praktikan", "koordinator"] },
    { title: "Penunjang Praktikum", url: "/penunjang-praktikum", icon: BookOpen, roles: ["praktikan", "asisten","koordinator"] },
    { title: "E-Learning", url: "/e-learning", icon: GraduationCap, roles: ["praktikan", "asisten", "koordinator"] },

    { title: "Jadwal Saya", url: "/jadwal-saya", icon: Calendar, roles: ["praktikan","asisten","koordinator"] }, 
    { title: "Manajemen User", url: "/manajemen-user", icon: Users, roles: ["koordinator", "asisten"] },
    { title: "Manajemen Jadwal", url: "/manajemen-jadwal", icon: CalendarDays, roles: ["asisten", "koordinator"] },
    
    { title: "Validasi Absensi", url: "/validasi-absensi", icon: CheckCircle, roles: ["asisten", "koordinator"] },
    { title: "Jadwal Jaga", url: "/jadwal-jaga", icon: Calendar, roles: ["asisten", "koordinator"] },
    { title: "Inventaris", url: "/inventaris", icon: Box, roles: ["asisten", "koordinator"] },
    { title: "Pilih Asisten", url: "/manajemen-kelas", icon: Users, roles: ["koordinator", "asisten"] },
    { title: "Input Jadwal Free", url: "/ketersediaan", icon: CalendarCheck, roles: ["koordinator", "asisten"] },
    { title: "Laporan Keuangan", url: "/laporan-keuangan", icon: FileText, roles: ["koordinator","asisten"] },

    { title: "Pengaturan", url: "/pengaturan", icon: Settings, roles: ["koordinator"] },
  ];

  // --- FILTER MENU ---
  const filteredMenu = menuItems.filter((item) => {
    if (!user || !item.roles.includes(user.role)) return false;
    if (user.role === 'koordinator') return true;
    if (user.role === 'praktikan') return true;
    if (user.role === 'penyewa') return true; // Penyewa can access everything in their roles list
    if (user.role === 'asisten') {
        // /absensi & /buat-qr selalu tampil untuk semua asisten
        if (item.url === '/absensi' || item.url === '/buat-qr') return true;
        if (item.url === '/absensi' && isPJAbsenToday) return true;
        if (RESTRICTED_MENUS.includes(item.url)) return allowedPaths.includes(item.url);
        return true; 
    }
    return false;
  });

  return (
    <Sidebar className="border-r border-white/10 bg-black text-white">
      {/* Tambahkan ID dan event onScroll di SidebarContent */}
      <SidebarContent 
        id="sidebar-scroll-area" 
        onScroll={handleScroll} 
        className="overflow-y-auto"
      >
        {/* HEADER / LOGO (Kombinasi Hitam dan Merah, Tulisan Putih) */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="bg-black p-2 rounded-lg">
            {/* Menggunakan logo geometris merah Anda */}
            <img src="/logo.png" alt="logo" className="w-8 h-8" /> 
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">Lab AP</span>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold tracking-wider text-white/60 uppercase mb-2 px-6">
            Menu Navigasi
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu className="space-y-1">
              {filteredMenu.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      onClick={() => navigate(item.url)}
                      className={`cursor-pointer rounded-lg transition-all duration-200 ${
                        isActive 
                          ? "bg-red-950/20 text-white font-semibold shadow-sm" 
                          : "text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 w-full py-1.5 px-1">
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-red-600" : "text-red-600"}`} />
                        <span className="text-sm">{item.title}</span>
                        
                        {/* BADGE TUGAS */}
                        {item.url === '/absensi' && isPJAbsenToday && !allowedPaths.includes('/absensi') && (
                            <span className="ml-auto text-[10px] font-bold bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded-full">
                              TUGAS
                            </span>
                        )}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER / PROFIL PENGGUNA */}
      <SidebarFooter className="p-4 border-t border-white/10">
        <div 
          className="p-3 rounded-xl bg-[#1a1a1a] text-white border border-white/10 shadow-sm mb-3 cursor-pointer hover:border-red-500/50 hover:shadow transition-all flex flex-col gap-3 group" 
          onClick={() => navigate('/profil')}
        >
          <div className="flex items-center gap-3">
             <div className="bg-primary/10 p-2.5 rounded-full text-red-600 flex-shrink-0">
                <User className="w-5 h-5"/>
             </div>
             <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate leading-tight">
                  {user?.full_name || "Pengguna"}
                </p>
                <p className="text-xs font-medium text-white opacity-70 capitalize mt-0.5 truncate">
                  {user?.role || "Guest"}
                </p>
             </div>
          </div>

          {user?.division && (
             <div className="w-full">
                <div className="text-[10px] font-bold tracking-widest bg-red-950/10 text-red-500 border border-red-500/20 px-2 py-1.5 rounded-md w-full text-center">
                   DIVISI {user.division.toUpperCase()}
                </div>
             </div>
          )}
        </div>

        <Button 
          variant="ghost"
          onClick={logout} 
          className="w-full justify-start text-red-500 hover:text-red-500 hover:bg-red-500/10 font-semibold h-10 rounded-lg border border-transparent hover:border-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Keluar Aplikasi
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}