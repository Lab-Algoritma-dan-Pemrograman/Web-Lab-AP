import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CalendarCheck, ArrowRightLeft, CheckCircle2, Clock, Send, Lock, Trash2, Users, XCircle, QrCode, FileDown, Filter } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export default function Absensi() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");

  // Semua Asisten, Koordinator, Sekretaris, K3 dianggap sebagai Staff di halaman ini (Bisa input manual)
  const isStaff = ['asisten', 'koordinator', 'sekretaris', 'k3'].includes(user?.role || '');
  const [isPJAbsenToday, setIsPJAbsenToday] = useState(false);

  // Hanya Koordinator atau PJ Absen yang bisa lihat tabel rekap semua user
  const isStaffTableMode = user?.role === 'koordinator' || isPJAbsenToday;

  // State Khusus untuk Hak Akses EXPORT
  const [hasExportAccess, setHasExportAccess] = useState(false);

  // State Scanner (Khusus Praktikan)
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // State Staff (Filter & Tabel)
  const [targetNim, setTargetNim] = useState("");
  const [targetStatus, setTargetStatus] = useState("Hadir");
  const [targetNote, setTargetNote] = useState("");
  const [allAttendanceData, setAllAttendanceData] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA'));

  // State Praktikan (Izin Pribadi)
  const [izinReason, setIzinReason] = useState("");
  const [izinType, setIzinType] = useState("Izin");
  const [izinDate, setIzinDate] = useState("");
  const [myOwnSchedules, setMyOwnSchedules] = useState<any[]>([]);
  const [selectedMySchedule, setSelectedMySchedule] = useState("");
  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState("");

  // --- CEK HAK AKSES EXPORT ---
  useEffect(() => {
    const checkExportAccess = async () => {
      if (!user) return;

      // Koor, Sekretaris, K3 otomatis boleh export
      if (['koordinator', 'sekretaris', 'k3'].includes(user.role)) {
        setHasExportAccess(true);
      }
      // Jika asisten, cek apakah divisinya punya akses ke menu ini
      else if (user.role === 'asisten' && user.division) {
        const { data } = await supabase
          .from('division_access')
          .select('id')
          .eq('division', user.division)
          .eq('menu_key', '/absensi');

        if (data && data.length > 0) {
          setHasExportAccess(true);
        }
      };
      checkExportAccess();
    }, [user];

    // --- CEK APAKAH PJ ABSEN ---
    useEffect(() => {
      const checkPJAbsen = async () => {
        if (user?.role !== 'asisten') return;
        const today = new Date().toLocaleDateString('en-CA');
        const { data } = await supabase
          .from('schedule_assignments')
          .select('id')
          .eq('user_id', user.id)
          .eq('task_role', 'PJ Absen')
          .eq('activity_date', today)
          .eq('status', 'aktif')
          .limit(1);

        if (data && data.length > 0) {
          setIsPJAbsenToday(true);
        }
      };
      checkPJAbsen();
    }, [user]);


    // --- FETCH DATA ---
    const fetchMyLogs = async () => {
      if (isStaff) return;
      const { data } = await supabase.from('attendance_logs')
        .select('*, schedules:reschedule_schedule_id(*)')
        .eq('custom_user_id', user?.id)
        .order('check_in_time', { ascending: false })
        .limit(10);
      setMyLogs(data || []);
    };

    const fetchAttendanceData = async () => {
      const { data } = await supabase
        .from('attendance_logs')
        .select(`
        id, 
        check_in_time, 
        status, 
        notes, 
        users:custom_user_id (full_name, username, major, class_code, shift)
      `)
        .gte('check_in_time', `${filterDate}T00:00:00`)
        .lte('check_in_time', `${filterDate}T23:59:59.999`)
        .order('check_in_time', { ascending: false });

      setAllAttendanceData(data || []);
    };

    const fetchSchedules = async () => {
      const { data } = await supabase.from('schedules').select('*').eq('type', 'praktikum');
      setAvailableSchedules(data || []);
    };

    const fetchMyOwnSchedules = async () => {
      if (isStaff || !user) return;
      const { data } = await supabase.from('group_members').select('schedules(*)').eq('student_id', user.id);
      const schedules = data?.map((m: any) => m.schedules).filter(Boolean) || [];
      setMyOwnSchedules(schedules);
    };

    const fetchAdminContact = async () => {
      if (isStaff) return;
      const { data } = await supabase.from('users')
        .select('phone_number')
        .in('role', ['sekretaris', 'koordinator'])
        .not('phone_number', 'is', null).limit(1);
      if (data && data.length > 0) setAdminPhone(data[0].phone_number);
    };

    // --- EFEK UTAMA & SUPABASE REALTIME ---
    useEffect(() => {
      fetchMyLogs();
      fetchSchedules();
      fetchMyOwnSchedules();
      fetchAdminContact();
    }, [user, isStaff]);

    useEffect(() => {
      fetchAttendanceData();

      const channel = supabase
        .channel('attendance_live_updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_logs' },
          (payload) => {
            console.log('Update Live Diterima!', payload);
            fetchAttendanceData();
            if (!isStaff) fetchMyLogs();
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [filterDate, isStaff]);

    // --- EXPORT EXCEL ---
    const handleExportExcel = () => {
      if (allAttendanceData.length === 0) {
        return toast.warning("Tidak ada data untuk diekspor pada tanggal ini.");
      }

      const dataToExport = allAttendanceData.map((log, index) => ({
        "No": index + 1,
        "Nama Mahasiswa": log.users?.full_name || "Unknown",
        "NIM": log.users?.username || "-",
        "Jurusan": log.users?.major || "-",
        "Kelas": log.users?.class_code || "-",
        "Shift": log.users?.shift || "-",
        "Waktu Absen": new Date(log.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        "Status": log.status,
        "Keterangan": log.notes || "-"
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daftar Hadir");
      XLSX.writeFile(wb, `Rekap_Absensi_Praktikan_${filterDate}.xlsx`);
      toast.success("Data berhasil diekspor ke Excel!");
    };


    // --- HELPER KEMBALI: WA & RESCHEDULE ---
    const getWaProofLink = (targetPhone: string | null, type: string, notes: string) => {
      if (!targetPhone) return '#';
      let cleanPhone = targetPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
      const text = `Halo Kak, saya ${user?.full_name} (${user?.username}) ingin mengirimkan bukti izin: ${type} - ${notes}`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    };

    const handleReschedule = async (logId: number) => {
      if (!selectedSchedule) return toast.error("Pilih jadwal pengganti!");
      setLoading(true);
      try {
        const { error } = await supabase.from('attendance_logs').update({
          reschedule_schedule_id: parseInt(selectedSchedule),
          reschedule_status: 'pending'
        }).eq('id', logId);

        if (error) throw error;
        toast.success("Jadwal diajukan. Tunggu persetujuan Asisten.");
      } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
    };

    // --- LOGIKA SCAN SEAMLESS & ANTI-SPAM ---
    useEffect(() => {
      let scanner: Html5Qrcode | null = null;

      if (activeTab === 'scan' && !isStaff && !scanLocked && !cameraError) {
        const timer = setTimeout(() => {
          const qrElement = document.getElementById("qr-reader");
          if (!qrElement) return;

          try {
            scanner = new Html5Qrcode("qr-reader");
            scanner.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              async (decodedText) => {
                if (scanner && scanner.isScanning) { await scanner.stop(); }
                setScanLocked(true);
                handleScanProcess(decodedText);
              },
              (err) => { /* Abaikan error frame */ }
            ).catch((err) => {
              setCameraError("Gagal mengakses kamera. Pastikan browser memiliki izin kamera.");
            });
          } catch (initError) {
            console.error("Scanner init error:", initError);
          }
        }, 500);

        return () => {
          clearTimeout(timer);
          if (scanner && scanner.isScanning) {
            scanner.stop().catch(console.error);
          }
        };
      }
    }, [activeTab, scanLocked, cameraError, isStaff]);

    const handleScanProcess = async (decodedText: string) => {
      toast.info("Memproses Kehadiran...");
      setLoading(true);
      try {
        let token = decodedText;
        if (decodedText.includes('token=')) {
          token = decodedText.split('token=')[1].split('&')[0];
        }

        const { data: session } = await supabase.from('qr_sessions').select('*').eq('token', token).eq('is_active', true).maybeSingle();

        if (!session) {
          toast.error("QR Code Salah atau Sesi Telah Berakhir!");
          setScanLocked(false); setLoading(false); return;
        }

        const today = new Date().toISOString().split('T')[0];
        const { data: ex } = await supabase.from('attendance_logs').select('*').eq('custom_user_id', user?.id).gte('check_in_time', `${today}T00:00:00`).lte('check_in_time', `${today}T23:59:59.999`).maybeSingle();

        if (ex) {
          toast.warning("Anda sudah melakukan absensi hari ini!");
          setLoading(false); return;
        }

        await supabase.from('attendance_logs').insert({
          custom_user_id: user?.id, status: "Hadir", notes: `Scan QR: ${session.title}`,
          check_in_time: new Date().toISOString(), is_verified: true, session_id: session.id
        });

        toast.success("Berhasil Absen!");
      } catch (err: any) {
        toast.error(err.message);
        setScanLocked(false);
      } finally {
        setLoading(false);
      }
    };

    // --- LOGIKA IZIN ---
    const handleSubmitIzin = async () => {
      if (!selectedMySchedule) return toast.error("Pilih jadwal kelas yang ditinggalkan!");
      if (!izinDate) return toast.error("Pilih tanggal absen (izin/sakit)!");
      if (!izinReason) return toast.error("Isi alasan izin secara detail!");

      setLoading(true);
      try {
        const schedInfo = myOwnSchedules.find(s => s.id.toString() === selectedMySchedule);
        const prefixInfo = schedInfo ? `[Kelas ${schedInfo.class_code} - ${schedInfo.day_of_week}] ` : "";
        const targetDateTime = new Date(`${izinDate}T08:00:00`).toISOString();

        await supabase.from('attendance_logs').insert({
          custom_user_id: user?.id,
          status: izinType,
          notes: prefixInfo + izinReason,
          check_in_time: targetDateTime,
          is_verified: false
        });
        toast.success("Terkirim! Silakan kirim bukti ke Asisten.");
        setIzinReason("");
        setIzinDate("");
        setSelectedMySchedule("");
      } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
    };

    // --- LOGIKA STAFF ---
    const handleStaffHelp = async () => {
      if (!targetNim) return toast.error("Masukkan NIM!"); setLoading(true);
      try {
        const { data: usr } = await supabase.from('users').select('id').eq('username', targetNim).maybeSingle();
        if (!usr) { toast.error("NIM tidak ditemukan."); setLoading(false); return; }

        const targetDateTime = new Date(`${filterDate}T08:00:00`).toISOString();

        await supabase.from('attendance_logs').insert({
          custom_user_id: usr.id,
          status: targetStatus,
          notes: targetNote || "Input Manual Oleh Staff",
          check_in_time: targetDateTime,
          is_verified: true
        });
        toast.success("Absensi Manual Berhasil!"); setTargetNim(""); setTargetNote("");
      } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
    };

    const deleteLog = async (id: number, logData: any) => {
      if (!confirm("Hapus data absen ini? Pastikan Anda tidak salah hapus!")) return;
      setLoading(true);
      try {
        // 1. Simpan riwayat penghapusan terlebih dahulu
        await supabase.from('attendance_deletion_history').insert({
          deleted_by: user?.id,
          target_user_id: logData.users?.username, // simpan nim
          snapshot_data: JSON.stringify(logData),
          reason: "Dihapus manual oleh Asisten",
          deleted_at: new Date().toISOString()
        });

        // 2. Hapus dari tabel utama
        const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
        if (error) throw error;
        toast.success("Data berhasil dihapus dan riwayat tersimpan");
      } catch (err: any) {
        toast.error("Gagal menghapus: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    const displayAttendance = isStaffTableMode ? allAttendanceData : allAttendanceData.filter(log => log.users?.username === user?.username);
    const totalHadir = allAttendanceData.filter(log => log.status === 'Hadir').length;

    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="text-primary" /> Manajemen Absensi Praktikan
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* KOLOM KIRI: SCAN / FORM */}
            <div className="lg:col-span-4 space-y-6">
              {!isStaff ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="scan">Scan QR</TabsTrigger><TabsTrigger value="izin">Izin</TabsTrigger></TabsList>

                  <TabsContent value="scan">
                    <Card className="shadow-lg border-t-4 border-t-primary">
                      <CardHeader className="pb-2 text-center"><CardTitle className="text-lg">Arahkan ke Layar</CardTitle></CardHeader>
                      <CardContent>
                        <div className="rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-slate-50 min-h-[300px] flex flex-col items-center justify-center relative">
                          {cameraError ? (
                            <div className="text-center p-6 space-y-4 text-red-500">
                              <XCircle className="w-12 h-12 mx-auto" />
                              <p className="text-sm font-medium">{cameraError}</p>
                              <Button variant="outline" onClick={() => setCameraError("")}>Coba Lagi</Button>
                            </div>
                          ) : scanLocked ? (
                            <div className="text-center p-6 space-y-4">
                              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto animate-in zoom-in duration-300" />
                              <div>
                                <p className="font-bold text-lg text-slate-800">Scan Terkunci</p>
                                <p className="text-xs text-muted-foreground mt-1">Sistem sedang memproses atau Anda sudah berhasil absen.</p>
                              </div>
                              <Button variant="outline" className="mt-2" onClick={() => setScanLocked(false)}>Scan Ulang</Button>
                            </div>
                          ) : (
                            <div className="w-full h-full relative">
                              <div id="qr-reader" className="w-full border-none [&>div]:border-none [&_video]:object-cover [&_video]:h-[300px]"></div>
                              <div className="absolute bottom-4 left-0 right-0 text-center">
                                <Badge className="bg-black/50 text-white backdrop-blur-sm px-3 py-1"><QrCode className="w-3 h-3 mr-2 inline" /> Mencari QR Code...</Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="izin">
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Form Izin / Sakit</CardTitle>
                        <CardDescription className="text-xs">Ajukan izin pada jadwal praktikum Anda.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Jenis Izin</Label>
                            <Select value={izinType} onValueChange={setIzinType}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Izin">Izin</SelectItem><SelectItem value="Sakit">Sakit</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Pilih Jadwal Anda</Label>
                            <Select value={selectedMySchedule} onValueChange={setSelectedMySchedule}>
                              <SelectTrigger>
                                <SelectValue placeholder={myOwnSchedules.length === 0 ? "Tidak ada jadwal" : "Pilih jadwal..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {myOwnSchedules.map(s => (
                                  <SelectItem key={s.id} value={s.id.toString()}>Kelas {s.class_code} ({s.day_of_week})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Tanggal Absen</Label>
                          <Input type="date" value={izinDate} onChange={e => setIzinDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Alasan Detail</Label>
                          <Input placeholder="Contoh: Ada acara keluarga / Dirawat di RS..." value={izinReason} onChange={e => setIzinReason(e.target.value)} />
                        </div>
                        <Button onClick={handleSubmitIzin} disabled={loading || myOwnSchedules.length === 0} className="w-full mt-2">
                          Kirim Pengajuan
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <Card className="shadow-md border-l-4 border-l-primary">
                  <CardHeader className="pb-2"><CardTitle className="text-lg">Bantu Absen Manual</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>NIM Praktikan</Label>
                      <Input placeholder="Masukkan NIM..." value={targetNim} onChange={e => setTargetNim(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={targetStatus} onValueChange={setTargetStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Hadir">Hadir</SelectItem>
                            <SelectItem value="Izin">Izin</SelectItem>
                            <SelectItem value="Sakit">Sakit</SelectItem>
                            <SelectItem value="Alpha">Alpha</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ket (Opsional)</Label>
                        <Input placeholder="..." value={targetNote} onChange={e => setTargetNote(e.target.value)} />
                      </div>
                    </div>
                    <Button onClick={handleStaffHelp} disabled={loading} className="w-full">Simpan Kehadiran</Button>
                    <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                      *Data yang diinput otomatis akan masuk ke dalam tanggal filter yang sedang Anda pilih di tabel.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* KOLOM KANAN: TABEL DAFTAR HADIR */}
            <div className="lg:col-span-8 flex flex-col">
              <Card className="flex-1 shadow-md">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" /> Daftar Kehadiran
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <CardDescription>Rekap absen praktikan.</CardDescription>
                        {isStaffTableMode && (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                            Total Hadir: {totalHadir}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] bg-green-50 text-green-600 border-green-200 animate-pulse px-1.5 py-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 inline-block"></span> Live
                        </Badge>
                      </div>
                    </div>

                    {/* BAGIAN FILTER & EXPORT UNTUK STAFF TERTENTU */}
                    {isStaff && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-white border rounded-md px-2 shadow-sm">
                          <Filter className="w-4 h-4 text-muted-foreground mr-2" />
                          <Input
                            type="date"
                            className="border-none h-8 shadow-none focus-visible:ring-0 px-0 w-[120px] text-sm"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                          />
                        </div>
                        {/* TOMBOL EXPORT HANYA MUNCUL JIKA HAS EXPORT ACCESS */}
                        {hasExportAccess && (
                          <Button variant="outline" size="sm" className="h-9 border-green-600 text-green-700 hover:bg-green-50" onClick={handleExportExcel}>
                            <FileDown className="w-4 h-4 mr-2" /> Export Excel
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative">
                    <Table>
                      <TableHeader className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="text-xs">Mahasiswa</TableHead>
                          <TableHead className="text-xs">Info</TableHead>
                          <TableHead className="text-xs">Waktu & Status</TableHead>
                          {isStaffTableMode && <TableHead className="text-xs text-right">Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayAttendance.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isStaffTableMode ? 4 : 3} className="h-40 text-center text-muted-foreground italic text-sm">
                              Belum ada data absensi pada tanggal ini.
                            </TableCell>
                          </TableRow>
                        ) : (
                          displayAttendance.map((log) => (
                            <TableRow key={log.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell>
                                <div className="font-bold text-sm">{log.users?.full_name || "Unknown"}</div>
                                <div className="text-[11px] text-muted-foreground font-mono">{log.users?.username}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-[11px] font-semibold">{log.users?.class_code} - {log.users?.major}</div>
                                <div className="text-[11px] text-muted-foreground">Shift: {log.users?.shift || "-"}</div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  <Badge variant="outline" className={`text-[10px] ${log.status === 'Hadir' ? 'bg-green-50 text-green-700 border-green-200' : log.status === 'Alpha' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                    {log.status} • {new Date(log.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </Badge>
                                  {log.status !== 'Hadir' && <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[120px]">{log.notes}</span>}
                                </div>
                              </TableCell>
                              {isStaffTableMode && (
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteLog(log.id, log)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* --- RIWAYAT PRIBADI (HANYA MUNCUL JIKA PRAKTIKAN) --- */}
          {!isStaff && myLogs.length > 0 && (
            <div className="space-y-4 pt-6 border-t mt-6">
              <h3 className="font-bold flex items-center gap-2 text-lg text-gray-800">
                <Clock className="w-5 h-5 text-primary" /> Riwayat & Status Pengajuan Saya
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLogs.map(log => (
                  <Card key={log.id} className="p-4 shadow-sm border-l-4 border-l-primary/60">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant={log.status === 'Hadir' ? "default" : "destructive"}>{log.status}</Badge>
                          <span className="text-xs font-medium text-gray-500">{new Date(log.check_in_time).toLocaleDateString('id-ID')}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{log.notes}</p>

                        {log.reschedule_status === 'pending' && <Badge variant="outline" className="mt-2 bg-yellow-50 text-yellow-700 border-yellow-200">Menunggu ACC Jadwal</Badge>}
                        {log.reschedule_status === 'approved' && <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">Jadwal Fix: {log.schedules?.day_of_week} {log.schedules?.start_time?.slice(0, 5)}</Badge>}
                        {log.reschedule_status === 'rejected' && <Badge variant="outline" className="mt-2 bg-red-50 text-red-700 border-red-200">Jadwal Ditolak, Pilih Lagi</Badge>}
                      </div>

                      <div className="flex flex-col gap-2 items-end w-full xl:w-auto">
                        {log.status !== 'Hadir' && adminPhone && (
                          <a href={getWaProofLink(adminPhone, log.status, log.notes)} target="_blank" rel="noreferrer" className="w-full xl:w-auto">
                            <Button size="sm" className="bg-[#25D366] hover:bg-[#1ebd5c] text-white h-8 text-xs w-full">
                              <Send className="w-3 h-3 mr-2" /> Kirim Bukti via WA
                            </Button>
                          </a>
                        )}

                        {log.is_verified && log.status !== 'Hadir' && (
                          <>
                            {(!log.reschedule_status || log.reschedule_status === 'rejected') && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10 h-8 text-xs w-full">
                                    <ArrowRightLeft className="w-3 h-3 mr-2" /> Pilih Jadwal
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Pilih Jadwal Pengganti</DialogTitle></DialogHeader>
                                  <div className="py-4 space-y-4">
                                    <Label>Jadwal Tersedia:</Label>
                                    <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                                      <SelectTrigger><SelectValue placeholder="Pilih Jadwal..." /></SelectTrigger>
                                      <SelectContent>
                                        {availableSchedules.map(s => (
                                          <SelectItem key={s.id} value={s.id.toString()}>{s.day_of_week} - {s.start_time.slice(0, 5)} ({s.title})</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleReschedule(log.id)} disabled={loading} className="w-full">Ajukan Jadwal Ini</Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            {log.reschedule_status === 'pending' && (
                              <Button size="sm" disabled className="h-8 text-xs w-full bg-yellow-100 text-yellow-700 border-yellow-200 opacity-100">
                                <Clock className="w-3 h-3 mr-2" /> Menunggu Verifikasi
                              </Button>
                            )}
                            {log.reschedule_status === 'approved' && (
                              <Button size="sm" variant="ghost" disabled className="h-8 text-xs w-full text-green-700 opacity-100">
                                <Lock className="w-3 h-3 mr-2" /> Jadwal Terkunci
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

        </div>
      </DashboardLayout>
    );
  }