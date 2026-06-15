import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, FileText, QrCode, ClipboardCheck, Users, 
  CheckCircle2, Phone, Pencil, Loader2, Save,
  BookOpen, MessageSquare, Database
} from "lucide-react";

// --- KOMPONEN: KARTU KONTAK & EDIT HP ---
function UserContactCard() {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchPhone = async () => {
      if (!user) return;
      // Use the stats RPC to get basic profile info or a specific profile RPC
      const { data } = await supabase.rpc('get_dashboard_stats_secure', { p_viewer_id: user.id });
      if (data && data.user_phone) {
        setPhone(data.user_phone || "");
        setNewPhone(data.user_phone || "");
      }
    };
    fetchPhone();
  }, [user]);

  const handleSavePhone = async () => {
    if (!newPhone) return toast.error("Nomor HP tidak boleh kosong");
    setLoading(true);
    try {
      const { error } = await supabase.rpc('update_user_profile_secure', {
        p_caller_id: user.id,
        p_phone_number: newPhone
      });
      if (error) throw error;
      setPhone(newPhone);
      toast.success("Nomor WhatsApp berhasil diperbarui!");
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error("Gagal update: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="card-hover border-2 border-fun-green shadow-bubbly-green rounded-2xl bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Kontak WhatsApp Aktif</CardTitle>
        <Phone className="h-4 w-4 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
            <div>
                <div className="text-xl font-bold">{phone || "-"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                    {phone ? "Digunakan untuk validasi izin" : "Harap lengkapi nomor HP!"}
                </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full"><Pencil className="h-3 w-3" /></Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ubah Nomor WhatsApp</DialogTitle>
                        <DialogDescription>
                            Perbarui nomor WhatsApp Anda untuk mempermudah koordinasi dan validasi absensi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Nomor HP (Format: 08xx / 62xx)</Label>
                            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))} placeholder="Contoh: 08123456789" type="tel" />
                            <p className="text-xs text-muted-foreground">Pastikan nomor ini aktif di WhatsApp.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSavePhone} disabled={loading} className="w-full">
                            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4"/>} Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// --- DASHBOARD PRAKTIKAN ---
function PraktikanDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalKelas: 0, attendanceRate: 0, totalFeedback: 0 });
  const [jadwal, setJadwal] = useState<any[]>([]);
  const [absensi, setAbsensi] = useState<any[]>([]);

  useEffect(() => {
      const fetchData = async () => {
          if (!user) return;

          // 1. Fetch Stats via Secure RPC
          const { data: globalStats } = await supabase.rpc('get_dashboard_stats_secure', { p_viewer_id: user.id });
          
          // 2. Fetch Recent Attendance via Secure RPC
          const { data: attendanceData } = await supabase.rpc('get_attendance_logs_secure', { p_viewer_id: user.id });
          setAbsensi((attendanceData || []).slice(0, 4));

          // 3. Fetch My Groups via Secure RPC
          const { data: memberData } = await supabase.rpc('get_group_members_secure', { p_viewer_id: user.id });
          const schedules = (memberData || []).map((m: any) => ({
            title: m.schedule_title,
            day_of_week: m.schedule_day,
            start_time: m.schedule_time,
            end_time: m.schedule_time, // Placeholder for end time if not in RPC
            class_code: m.schedule_class_code
          }));
          setJadwal(schedules);
          
          setStats({ 
            totalKelas: globalStats?.total_kelas || 0, 
            attendanceRate: globalStats?.attendance_rate || 0, 
            totalFeedback: globalStats?.total_feedback || 0 
          });
      };
      
      fetchData();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Selamat Datang, {user?.full_name}!</h1>
        <p className="text-muted-foreground mt-1">Pantau jadwal, absensi, dan informasi praktikum Anda di sini.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UserContactCard />
        <Card className="card-hover border-2 border-fun-blue shadow-bubbly-blue rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kelas Diambil</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalKelas}</div>
            <p className="text-xs text-muted-foreground">Kelompok Praktikum</p>
          </CardContent>
        </Card>
        <Card className="card-hover border-2 border-fun-purple shadow-bubbly-purple rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kehadiran</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">Rasio Kehadiran</p>
          </CardContent>
        </Card>
        <Card className="card-hover border-2 border-fun-yellow shadow-bubbly-yellow rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kritik & Saran</CardTitle>
            <MessageSquare className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFeedback}</div>
            <p className="text-xs text-muted-foreground">Pesan dikirim</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Calendar className="h-5 w-5 text-primary" /> Jadwal Kelompok Saya</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jadwal.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada jadwal plotting.</p> :
              jadwal.map((schedule, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{schedule.title}</p>
                    <p className="text-xs text-muted-foreground">{schedule.day_of_week} • {schedule.start_time?.slice(0,5)} - {schedule.end_time?.slice(0,5)}</p>
                  </div>
                  <Badge variant="secondary">Kelas {schedule.class_code}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><QrCode className="h-5 w-5 text-primary" /> Riwayat Absensi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {absensi.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data absensi.</p> :
              absensi.map((log, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-foreground">{new Date(log.check_in_time).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'short'})}</p>
                    <p className="text-xs text-muted-foreground">Pukul: {new Date(log.check_in_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    log.status === "Hadir" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- DASHBOARD ASISTEN ---
function AsistenDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ mahasiswa: 0, kelas: 0, absenSaya: 0, jadwalJaga: 0 });

  useEffect(() => {
      const fetchData = async () => {
          if (!user) return;

          const { data: statsData } = await supabase.rpc('get_dashboard_stats_secure', { p_viewer_id: user.id });

          // Recent Activity/Summary
          setStats({ 
              mahasiswa: statsData?.total_students_under_me || 0, 
              kelas: statsData?.total_classes_under_me || 0, 
              absenSaya: statsData?.my_attendance_count || 0,
              jadwalJaga: statsData?.upcoming_shifts_count || 0 
          });
      };
      fetchData();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Asisten</h1>
        <p className="text-muted-foreground mt-1">Pantau total praktikan kelompok Anda dan jadwal bimbingan.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2"><UserContactCard /></div>
        
        <Card className="card-hover border-2 border-fun-purple shadow-bubbly-purple rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jadwal Jaga</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.jadwalJaga}</div>
            <p className="text-xs text-muted-foreground">Shift mendatang</p>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-fun-blue shadow-bubbly-blue rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Praktikan</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mahasiswa}</div>
            <p className="text-xs text-muted-foreground">Dalam bimbingan</p>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-2 border-fun-yellow shadow-bubbly-yellow rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Log Kehadiran</CardTitle>
            <QrCode className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.absenSaya}</div>
            <p className="text-xs text-muted-foreground">Absen divalidasi</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- DASHBOARD KOORDINATOR ---
function KoordinatorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ 
      totalUsers: 0, 
      totalAsisten: 0, 
      totalPraktikan: 0, 
      totalFeedback: 0,
      kelasBimbingan: 0,
      praktikanBimbingan: 0,
      jadwalJaga: 0, // <--- STATE BARU UNTUK JADWAL JAGA
      pendingAbsenPraktikan: 0,
      pendingIzinAsisten: 0 
  });

  useEffect(() => {
      const fetchGlobalStats = async () => {
          if (!user) return;

          const { data: statsData } = await supabase.rpc('get_dashboard_stats_secure', { p_viewer_id: user.id });

          setStats({ 
              totalUsers: statsData?.total_users || 0, 
              totalAsisten: statsData?.total_assistants || 0, 
              totalPraktikan: statsData?.total_students || 0, 
              totalFeedback: statsData?.total_feedback || 0,
              kelasBimbingan: statsData?.total_classes_under_me || 0,
              praktikanBimbingan: statsData?.total_students_under_me || 0,
              jadwalJaga: statsData?.upcoming_shifts_count || 0,
              pendingAbsenPraktikan: statsData?.pending_attendance || 0,
              pendingIzinAsisten: statsData?.pending_assistant_requests || 0
          });
      };
      
      fetchGlobalStats();
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-dark mb-2 tracking-tight">Pusat Kendali Koordinator</h1>
        <p className="text-gray-500 font-bold text-sm">Rincian data global laboratorium dan daftar tugas validasi Anda.</p>
      </div>

      {/* BARIS 1: METRIK GLOBAL LABORATORIUM (4 Kolom) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Pengguna (Maroon) */}
        <div className="bg-white rounded-3xl p-6 border-2 border-red-100 shadow-bubbly-red card-bubbly relative overflow-hidden group cursor-default">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pengguna</p>
              <h3 className="text-4xl font-black text-dark mt-1">{stats.totalUsers}</h3>
            </div>
            <div className="w-12 h-12 bg-red-50 text-maroon rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Database className="w-5 h-5 text-maroon" />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-500">Semua akun di sistem</p>
          <Users className="absolute -bottom-4 -right-4 w-20 h-20 text-red-50 opacity-50" />
        </div>

        {/* Total Asisten (Blue) */}
        <div className="bg-white rounded-3xl p-6 border-2 border-blue-100 shadow-bubbly-blue card-bubbly relative overflow-hidden group cursor-default">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Asisten</p>
              <h3 className="text-4xl font-black text-dark mt-1">{stats.totalAsisten}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-fun-blue rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Users className="w-5 h-5 text-fun-blue" />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-500">Asisten lab terdaftar</p>
          <Users className="absolute -bottom-4 -right-4 w-20 h-20 text-blue-50 opacity-50" />
        </div>

        {/* Total Praktikan (Orange) */}
        <div className="bg-white rounded-3xl p-6 border-2 border-orange-100 shadow-bubbly-orange card-bubbly relative overflow-hidden group cursor-default">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Praktikan</p>
              <h3 className="text-4xl font-black text-dark mt-1">{stats.totalPraktikan}</h3>
            </div>
            <div className="w-12 h-12 bg-orange-50 text-fun-orange rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <Users className="w-5 h-5 text-fun-orange" />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-500">Praktikan terdaftar</p>
          <GraduationCap className="absolute -bottom-4 -right-4 w-20 h-20 text-orange-50 opacity-50" />
        </div>

        {/* Kritik & Saran (Purple) */}
        <div className="bg-white rounded-3xl p-6 border-2 border-purple-100 shadow-bubbly-purple card-bubbly relative overflow-hidden group cursor-pointer hover:border-fun-purple">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kritik & Saran</p>
              <h3 className={`text-4xl font-black mt-1 ${stats.totalFeedback > 0 ? "text-dark" : "text-gray-300"}`}>{stats.totalFeedback}</h3>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-fun-purple rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <MessageSquare className="w-5 h-5 text-fun-purple" />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-fun-green inline shrink-0" /> Kotak masuk bersih
          </p>
        </div>

      </div>

      {/* BARIS 2: Tugas Validasi / Tertunda */}
      <div>
        <h3 className="text-lg font-black text-dark mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-maroon animate-pulse" /> Tugas & Validasi Pending
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          
          {/* Jadwal Jaga */}
          <div className="bg-blue-50/50 p-5 rounded-2xl border-2 border-blue-100 shadow-sm hover:shadow-[0_4px_0_#BFDBFE] hover:-translate-y-1 transition-all cursor-pointer group">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-black text-gray-600">Jadwal Jaga</p>
              <Calendar className="w-4 h-4 text-fun-blue group-hover:animate-bounce" />
            </div>
            <h4 className="text-3xl font-black text-dark mb-1">{stats.jadwalJaga}</h4>
            <p className="text-[10px] font-bold text-gray-400">Shift mendatang</p>
          </div>

          {/* Kelas Bimbingan */}
          <div className="bg-green-50/50 p-5 rounded-2xl border-2 border-green-100 shadow-sm hover:shadow-[0_4px_0_#BBF7D0] hover:-translate-y-1 transition-all cursor-pointer group">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-black text-gray-600">Kelas Bimbingan</p>
              <BookOpen className="w-4 h-4 text-fun-green group-hover:animate-bounce" />
            </div>
            <h4 className="text-3xl font-black text-dark mb-1">{stats.kelasBimbingan}</h4>
            <p className="text-[10px] font-bold text-gray-400">Jadwal kelompok Anda</p>
          </div>

          {/* Praktikan Bimbingan */}
          <div className="bg-teal-50/50 p-5 rounded-2xl border-2 border-teal-100 shadow-sm hover:shadow-[0_4px_0_#99F6E4] hover:-translate-y-1 transition-all cursor-pointer group">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-black text-gray-600">Praktikan Bimbingan</p>
              <Users className="w-4 h-4 text-teal-400 group-hover:animate-bounce" />
            </div>
            <h4 className="text-3xl font-black text-dark mb-1">{stats.praktikanBimbingan}</h4>
            <p className="text-[10px] font-bold text-gray-400">Di kelompok Anda</p>
          </div>

          {/* Approval Absen */}
          <div className="bg-red-50 p-5 rounded-2xl border-2 border-red-200 shadow-sm hover:shadow-[0_4px_0_#FECACA] hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-black text-maroon">Approval Absen</p>
              <FileText className="w-4 h-4 text-maroon group-hover:animate-bounce" />
            </div>
            <h4 className="text-3xl font-black text-maroon mb-1">{stats.pendingAbsenPraktikan}</h4>
            <p className="text-[10px] font-bold text-red-400">Praktikan pending</p>
          </div>

          {/* Approval Izin */}
          <div className="bg-purple-50 p-5 rounded-2xl border-2 border-purple-200 shadow-sm hover:shadow-[0_4px_0_#E9D5FF] hover:-translate-y-1 transition-all cursor-pointer group">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-black text-fun-purple">Approval Izin</p>
              <ClipboardCheck className="w-4 h-4 text-fun-purple group-hover:animate-bounce" />
            </div>
            <h4 className="text-3xl font-black text-fun-purple mb-1">{stats.pendingIzinAsisten}</h4>
            <p className="text-[10px] font-bold text-purple-400">Asisten pending</p>
          </div>

        </div>
      </div>

    </div>
  );
}

// --- MAIN COMPONENT ---
export default function Beranda() {
  const { role } = useAuth();

  return (
    <DashboardLayout>
      {role === "praktikan" && <PraktikanDashboard />}
      {role === "asisten" && <AsistenDashboard />}
      {role === "koordinator" && <KoordinatorDashboard />}
      {!role && <PraktikanDashboard />}
    </DashboardLayout>
  );
}