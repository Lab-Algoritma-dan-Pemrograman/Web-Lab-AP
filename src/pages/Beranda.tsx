import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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
      const { error } = await supabase.from('users').update({ phone_number: newPhone }).eq('id', user?.id);
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
    <Card className="shadow-sm border-l-4 border-l-green-500">
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
                    <DialogHeader><DialogTitle>Ubah Nomor WhatsApp</DialogTitle></DialogHeader>
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
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kelas Diambil</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalKelas}</div>
            <p className="text-xs text-muted-foreground">Kelompok Praktikum</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kehadiran</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">Rasio Kehadiran</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-orange-500">
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
        
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jadwal Jaga</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.jadwalJaga}</div>
            <p className="text-xs text-muted-foreground">Shift mendatang</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Praktikan</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mahasiswa}</div>
            <p className="text-xs text-muted-foreground">Dalam bimbingan</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-l-4 border-l-orange-500">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pusat Kendali Koordinator</h1>
        <p className="text-muted-foreground mt-1">Rincian data global laboratorium dan daftar tugas validasi Anda.</p>
      </div>

      {/* BARIS 1: METRIK GLOBAL LABORATORIUM (4 Kolom) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengguna</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Semua akun di sistem</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Asisten</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAsisten}</div>
            <p className="text-xs text-muted-foreground">Asisten lab terdaftar</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Praktikan</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPraktikan}</div>
            <p className="text-xs text-muted-foreground">Praktikan terdaftar</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kritik & Saran</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFeedback}</div>
            <p className="text-xs text-muted-foreground">Total masukan masuk</p>
          </CardContent>
        </Card>
      </div>

      {/* BARIS 2: METRIK TUGAS PERSONAL & APPROVAL (Diubah jadi 5 Kolom) */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        
        {/* KARTU BARU: JADWAL JAGA */}
        <Card className="shadow-sm border-t-4 border-t-sky-500 bg-sky-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jadwal Jaga</CardTitle>
            <Calendar className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-900">{stats.jadwalJaga}</div>
            <p className="text-xs text-sky-600/80 font-medium">Shift mendatang</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-emerald-500 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kelas Bimbingan</CardTitle>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{stats.kelasBimbingan}</div>
            <p className="text-xs text-emerald-600/80 font-medium">Jadwal kelompok Anda</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-green-500 bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Praktikan Bimbingan</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{stats.praktikanBimbingan}</div>
            <p className="text-xs text-green-600/80 font-medium">Di kelompok Anda</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-rose-500 bg-rose-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Absen</CardTitle>
            <FileText className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-900">{stats.pendingAbsenPraktikan}</div>
            <p className="text-xs text-rose-600/80 font-medium">Praktikan pending</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-indigo-500 bg-indigo-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Izin</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">{stats.pendingIzinAsisten}</div>
            <p className="text-xs text-indigo-600/80 font-medium">Asisten pending</p>
          </CardContent>
        </Card>
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