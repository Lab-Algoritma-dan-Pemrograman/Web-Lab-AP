import { useState, useEffect } from "react";
import { 
  Home, BookOpen, PenTool, Calendar, Users, Settings, LogOut, 
  Box, FileText, User, CalendarCheck, CheckCircle, ClipboardCheck,
  MessageSquare, QrCode, CalendarDays, GraduationCap, PackageSearch, ListChecks, History
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { roleAllowed, canonRole } from "@/lib/roles";
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
  "/manajemen-sewa",
  "/audit-log"
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
        const { data, error } = await supabase.rpc('check_pj_absen_today', {
          p_user_id: user.id
        });

        if (error) throw error;
        setIsPJAbsenToday(!!data);

      } catch (err) {
        console.error("Gagal load PJ status:", err);
      }
    };

    fetchPJStatus();
  }, [user]);

  // Definisi Menu Lengkap
  const menuItems = [
    { title: "Beranda", url: "/beranda", icon: Home, roles: ["mahasiswa", "asisten", "koordinator", "peminjam"] },
    { title: "Profil Saya", url: "/profil", icon: User, roles: ["mahasiswa", "asisten", "koordinator", "peminjam"] },
    
    { title: "Sewa & Pinjam", url: "/sewa-barang", icon: PackageSearch, roles: ["peminjam"] },
    { title: "Manajemen Sewa", url: "/manajemen-sewa", icon: ListChecks, roles: ["asisten", "koordinator"] },

    { title: "Absensi", url: "/absensi", icon: CalendarCheck, roles: ["mahasiswa", "asisten", "koordinator"] },
    { title: "Buat QR Absen", url: "/buat-qr", icon: QrCode, roles: ["asisten", "koordinator"] },
    { title: "Kritik & Saran", url: "/kritik-saran", icon: MessageSquare, roles: ["mahasiswa", "koordinator"] },
    { title: "Penunjang Praktikum", url: "/penunjang-praktikum", icon: BookOpen, roles: ["mahasiswa", "asisten","koordinator"] },
    { title: "E-Learning", url: "/e-learning", icon: GraduationCap, roles: ["mahasiswa", "asisten", "koordinator"] },

    { title: "Jadwal Saya", url: "/jadwal-saya", icon: Calendar, roles: ["mahasiswa","asisten","koordinator"] }, 
    { title: "Manajemen User", url: "/manajemen-user", icon: Users, roles: ["koordinator", "asisten"] },
    { title: "Manajemen Jadwal", url: "/manajemen-jadwal", icon: CalendarDays, roles: ["asisten", "koordinator"] },
    
    { title: "Validasi Absensi", url: "/validasi-absensi", icon: CheckCircle, roles: ["asisten", "koordinator"] },
    { title: "Jadwal Jaga", url: "/jadwal-jaga", icon: Calendar, roles: ["asisten", "koordinator"] },
    { title: "Inventaris", url: "/inventaris", icon: Box, roles: ["asisten", "koordinator"] },
    { title: "Pilih Asisten", url: "/manajemen-kelas", icon: Users, roles: ["koordinator", "asisten"] },
    { title: "Input Jadwal Free", url: "/ketersediaan", icon: CalendarCheck, roles: ["koordinator", "asisten"] },
    { title: "Laporan Keuangan", url: "/laporan-keuangan", icon: FileText, roles: ["koordinator","asisten"] },
    { title: "Audit Log", url: "/audit-log", icon: History, roles: ["koordinator", "asisten"] },

    { title: "Pengaturan", url: "/pengaturan", icon: Settings, roles: ["koordinator"] },
  ];

  // --- FILTER MENU ---
  const filteredMenu = menuItems.filter((item) => {
    if (!user) return false;
    const r = canonRole(user.role);
    // admin & koordinator: seluruh menu
    if (r === 'admin' || r === 'koordinator') return true;
    // praktikan & penyewa: menu umum sesuai roles list
    if (r === 'praktikan' || r === 'penyewa') return roleAllowed(r, item.roles);
    // asisten: roles list + pembatasan menu_key divisi
    if (r === 'asisten') {
        if (!roleAllowed(r, item.roles)) return false;
        // /absensi & /buat-qr selalu tampil untuk semua asisten
        if (item.url === '/absensi' || item.url === '/buat-qr') return true;
        if (item.url === '/absensi' && isPJAbsenToday) return true;
        if (RESTRICTED_MENUS.includes(item.url)) return allowedPaths.includes(item.url);
        return true;
    }
    return false;
  });

  return (
    <Sidebar className="border-r border-gray-100 bg-white text-dark shadow-[4px_0_24px_rgba(138,21,56,0.05)]">
      {/* Tambahkan ID dan event onScroll di SidebarContent */}
      <SidebarContent 
        id="sidebar-scroll-area" 
        onScroll={handleScroll} 
        className="overflow-y-auto"
      >
        {/* HEADER / LOGO */}
        <div className="p-6 pb-4 flex items-center space-x-3 mt-2 shrink-0">
          <img src="/logo.png" alt="Logo Lab AP" className="w-10 h-10 object-contain transform -rotate-6" />
          <span className="font-extrabold text-2xl tracking-tight text-dark">Lab AP</span>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2 px-6">
            Menu Navigasi
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <nav className="w-full" aria-label="Menu Utama">
              <SidebarMenu className="space-y-1">
                {filteredMenu.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        onClick={() => navigate(item.url)}
                        className="p-0 bg-transparent hover:bg-transparent h-auto cursor-pointer"
                      >
                        {isActive ? (
                          <div className="flex items-center space-x-3 px-4 py-3 bg-maroon text-white rounded-2xl shadow-bubbly-maroon font-black w-full transform transition-transform hover:-translate-y-0.5">
                            <item.icon className="w-5 h-5 text-center" />
                            <span className="text-sm font-black">{item.title}</span>
                            
                            {/* BADGE TUGAS */}
                            {item.url === '/absensi' && isPJAbsenToday && !allowedPaths.includes('/absensi') && (
                                <span className="ml-auto text-[10px] font-bold bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full">
                                  TUGAS
                                </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3 px-4 py-2.5 text-gray-500 hover:bg-maroon-bg hover:text-maroon rounded-xl transition-colors font-bold text-sm group w-full">
                            <item.icon className="w-5 h-5 text-center text-gray-400 group-hover:text-maroon transition-colors" />
                            <span className="text-sm font-bold">{item.title}</span>
                            
                            {/* BADGE TUGAS */}
                            {item.url === '/absensi' && isPJAbsenToday && !allowedPaths.includes('/absensi') && (
                                <span className="ml-auto text-[10px] font-bold bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded-full">
                                  TUGAS
                                </span>
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER / PROFIL PENGGUNA */}
      <SidebarFooter className="p-4 border-t border-gray-100">
        <div 
          className="bg-dark rounded-2xl p-4 shadow-bubbly-dark relative overflow-hidden group cursor-pointer flex flex-col gap-3" 
          onClick={() => navigate('/profil')}
        >
          {/* Deco */}
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20 flex-shrink-0">
              <User className="w-5 h-5"/>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-white uppercase tracking-tight truncate leading-tight">
                {user?.full_name || "Pengguna"}
              </p>
              <p className="text-[10px] font-bold text-gray-400 capitalize mt-0.5 leading-none">
                {user?.role || "Guest"}
              </p>
            </div>
          </div>

          {user?.division && (
            <div className="bg-red-100 rounded-lg py-1.5 text-center shadow-sm relative z-10">
              <p className="text-[10px] font-black text-maroon tracking-widest uppercase">
                DIVISI {user.division.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        <Button 
          variant="ghost"
          onClick={logout} 
          className="mt-4 flex items-center justify-center space-x-2 text-maroon hover:text-red-600 font-bold text-sm transition-colors w-full bg-red-50 hover:bg-red-100 py-2.5 h-auto rounded-xl border border-red-100 hover:border-red-200"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Keluar Aplikasi
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}