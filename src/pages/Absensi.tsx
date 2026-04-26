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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
  // PERBARUAN: Semua asisten + koor bisa lihat tabel rekap & total hadir
  const isStaffTableMode = ['asisten', 'koordinator', 'sekretaris', 'k3'].includes(user?.role || '');

  // State Khusus untuk Hak Akses EXPORT & DELETE (FULL ACCESS)
  const [hasExportAccess, setHasExportAccess] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [hasDeletePower, setHasDeletePower] = useState(false);

  // State Scanner (Khusus Praktikan)
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // State Staff (Filter & Tabel)
  const [targetNim, setTargetNim] = useState("");
  const [targetStatus, setTargetStatus] = useState("Hadir");
  const [targetNote, setTargetNote] = useState("");
  const [allAttendanceData, setAllAttendanceData] = useState<any[]>([]);
  const [deletionHistory, setDeletionHistory] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA'));

  // State Praktikan (Izin Pribadi)
  const [izinReason, setIzinReason] = useState("");
  const [izinType, setIzinType] = useState("Izin");
  const [izinDate, setIzinDate] = useState("");
  const [myOwnSchedules, setMyOwnSchedules] = useState<any[]>([]);
  const [selectedMySchedule, setSelectedMySchedule] = useState("");
  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [waTemplates, setWaTemplates] = useState<any>(null);

  // --- CEK HAK AKSES EXPORT ---
  useEffect(() => {
    const checkExportAccess = async () => {
      if (!user) return;

      // Koor, Sekretaris, K3 otomatis boleh export & full access
      if (['koordinator', 'sekretaris', 'k3'].includes(user.role)) {
        setHasExportAccess(true);
        setHasFullAccess(true);
      }
      // Jika asisten, cek apakah divisinya punya akses ke menu ini (Validasi/Sekre)
      else if (user.role === 'asisten') {
        const { data: hasAbsen } = await supabase.rpc('check_menu_access_secure', { 
            p_viewer_id: user.id, 
            p_menu_key: '/absensi' 
        });
        const { data: hasValidasi } = await supabase.rpc('check_menu_access_secure', { 
            p_viewer_id: user.id, 
            p_menu_key: '/validasi-absensi' 
        });

        if (hasAbsen) setHasExportAccess(true);
        if (hasValidasi) setHasFullAccess(true);
      }
    };
    checkExportAccess();
  }, [user]);

  // --- LOGIKA HAK HAPUS ---
  useEffect(() => {
    // Siapa yang bisa hapus? 
    // 1. Koordinator/Sekretaris/K3 (hasFullAccess)
    // 2. PJ Absen Hari Ini
    // 3. Asisten dengan hak akses Validasi Absensi (hasFullAccess)
    setHasDeletePower(hasFullAccess || isPJAbsenToday);
  }, [hasFullAccess, isPJAbsenToday]);

  // --- CEK APAKAH PJ ABSEN ---
  useEffect(() => {
    const checkPJAbsen = async () => {
      if (user?.role !== 'asisten') return;
      const { data: isPJ } = await supabase.rpc('is_pj_absen_today', { p_user_id: user.id });
      if (isPJ) setIsPJAbsenToday(true);
    };
    checkPJAbsen();
  }, [user]);


  // --- FETCH DATA ---
  const fetchMyLogs = async () => {
    if (isStaff || !user) return;
    const { data } = await supabase.rpc('get_attendance_logs_secure', { 
        p_viewer_id: user.id,
        p_date_filter: null // Always fetch all logs for the student's personal history
    });
    
    // Map to include nested schedules for "Riwayat & Status Pengajuan Saya"
    const formatted = (data || []).map((log: any) => ({
      ...log,
      schedules: log.reschedule_schedule_id ? {
        id: log.reschedule_schedule_id,
        title: log.schedule_title,
        day_of_week: log.schedule_day,
        start_time: log.schedule_time
      } : null
    }));
    
    setMyLogs(formatted || []);
  };

  const fetchAttendanceData = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_attendance_logs_secure', { 
        p_viewer_id: user.id,
        p_date_filter: filterDate || null
    });

    // Map to the structure expected by the UI (nesting users and schedules)
    const formatted = (data || []).map((log: any) => ({
      ...log,
      users: {
        full_name: log.user_full_name,
        role: log.user_role,
        username: log.user_username,
        major: log.user_major,
        class_code: log.user_class_code,
        shift: log.user_shift
      },
      schedules: log.reschedule_schedule_id ? {
        id: log.reschedule_schedule_id,
        title: log.schedule_title,
        day_of_week: log.schedule_day,
        start_time: log.schedule_time
      } : null
    }));

    setAllAttendanceData(formatted || []);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase.rpc('get_schedules_secure', { p_viewer_id: user?.id || 0 });
    const praktikumOnly = (data || []).filter((s: any) => s.type === 'praktikum');
    setAvailableSchedules(praktikumOnly);
  };

  const fetchDeletionHistory = async () => {
    if (!hasFullAccess || !user) return;
    const { data } = await supabase.rpc('get_deletion_history_secure', { p_viewer_id: user.id });
    setDeletionHistory(data || []);
  };

  const fetchMyOwnSchedules = async () => {
    if (isStaff || !user) return;
    const { data } = await supabase.rpc('get_personal_schedules_secure', { p_viewer_id: user.id });
    // Map to match the older structure if needed
    const formatted = (data || []).map((s: any) => ({
        id: s.schedule_id,
        title: s.schedule_title,
        day_of_week: s.schedule_day,
        start_time: s.schedule_start,
        end_time: s.schedule_end,
        major: s.schedule_major,
        class_code: s.schedule_class
    }));
    setMyOwnSchedules(formatted);
  };

  const fetchAdminContact = async () => {
    if (isStaff || !user) return;
    const { data } = await supabase.rpc('get_smart_validation_contact_secure', { p_student_id: user.id });
    if (data && data.length > 0) {
      setAdminPhone(data[0].phone_number);
      setAdminCode(data[0].assistant_code);
    }
  };

  // --- EFEK UTAMA & SUPABASE REALTIME ---
  useEffect(() => {
    fetchMyLogs();
    fetchSchedules();
    fetchMyOwnSchedules();
    fetchAdminContact();
    fetchDeletionHistory();
    
    // Fetch WA Templates
    const fetchSettings = async () => {
        if (!user) return;
        const { data } = await supabase.rpc('get_system_settings_full_secure', { p_viewer_id: user.id });
        if (data && data.length > 0) setWaTemplates(data[0].wa_templates);
    };
    fetchSettings();
  }, [user, isStaff, hasFullAccess]);

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

    // Listen for custom toast errors from WA link
    const handleToastError = (e: any) => toast.error(e.detail);
    window.addEventListener('toast-error', handleToastError);

    return () => { 
      supabase.removeChannel(channel); 
      window.removeEventListener('toast-error', handleToastError);
    };
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
      "Keterangan": log.notes || "-",
      "Petugas/Log": log.recorded_by_name || "Mandiri"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Hadir");
    XLSX.writeFile(wb, `Rekap_Absensi_Praktikan_${filterDate}.xlsx`);
    toast.success("Data berhasil diekspor ke Excel!");
  };


  // --- HELPER KEMBALI: WA & RESCHEDULE ---
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Pagi";
    if (hour < 15) return "Siang";
    if (hour < 19) return "Sore";
    return "Malam";
  };

  const getHonorific = (code: string | null) => {
    if (!code) return "Kak";
    return code.startsWith('P') ? "Kak" : "Bang";
  };

  const getWaProofLink = (targetPhone: string | null, type: string, notes: string) => {
    if (!targetPhone) {
      return "javascript:window.dispatchEvent(new CustomEvent('toast-error', {detail: 'Nomor WhatsApp Admin belum diset. Harap hubungi Asisten secara langsung.'}));";
    }
    let cleanPhone = targetPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    
    // Default fallback text
    let text = `Selamat ${getGreeting()} ${getHonorific(adminCode)}, Mohon maaf mengganggu waktunya. Saya ${user?.full_name} (${user?.username}) ingin mengirimkan bukti izin: ${type} - ${notes}`;
    
    if (waTemplates?.absen_izin) {
        text = waTemplates.absen_izin
            .replace(/{{waktu}}/g, getGreeting())
            .replace(/{{panggilan}}/g, getHonorific(adminCode))
            .replace(/{{nama}}/g, user?.full_name || "")
            .replace(/{{nim}}/g, user?.username || "")
            .replace(/{{tipe}}/g, type)
            .replace(/{{alasan}}/g, notes)
            .replace(/{{kelas}}/g, user?.class_code || "")
            .replace(/{{jurusan}}/g, user?.division || "");
    }
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleReschedule = async (logId: number) => {
    if (!selectedSchedule) return toast.error("Pilih jadwal pengganti!");
    setLoading(true);
    try {
      const { error } = await supabase.rpc('request_reschedule_secure', {
        p_log_id: logId,
        p_new_schedule_id: parseInt(selectedSchedule)
      });

      if (error) throw error;
      toast.success("Jadwal diajukan. Tunggu persetujuan Asisten.");
      setSelectedSchedule("");
    } catch (err: any) { 
      toast.error(err.message); 
    } finally { 
      setLoading(false); 
    }
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

      const { data: session } = await supabase.rpc('get_qr_session_secure', { p_token: token }).maybeSingle();

      if (!session) {
        toast.error("QR Code Salah atau Sesi Telah Berakhir!");
        setScanLocked(false); setLoading(false); return;
      }

      const { data: already } = await supabase.rpc('check_already_absent_secure', { p_user_id: user.id });
      if (already) {
        toast.warning("Anda sudah melakukan absensi hari ini!");
        setLoading(false); return;
      }

      const { error } = await supabase.rpc('upsert_attendance_log_secure', {
        p_caller_id: user.id,
        p_target_user_id: user.id,
        p_status: "Hadir",
        p_notes: `Scan QR: ${session.title}`,
        p_check_in: new Date().toISOString(),
        p_is_verified: true,
        p_type: 'scan',
        p_session_id: session.id
      });

      if (error) throw error;
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

      const { error } = await supabase.rpc('upsert_attendance_log_secure', {
        p_caller_id: user.id,
        p_target_user_id: user.id,
        p_status: izinType,
        p_notes: prefixInfo + izinReason,
        p_check_in: targetDateTime,
        p_is_verified: false,
        p_type: 'izin'
      });
      if (error) throw error;
      toast.success("Terkirim! Silakan kirim bukti ke Asisten.");
      setIzinReason("");
      setIzinDate("");
      setSelectedMySchedule("");
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  // --- LOGIKA STAFF ---
  // Ditambahkan pembungkus async untuk input manual oleh staff
  const handleStaffHelp = async () => {
    setLoading(true);
    try {
      const { data: allUsers } = await supabase.rpc('get_users_secure', { p_viewer_id: user.id });
      const usr = (allUsers || []).find((u: any) => u.username === targetNim);
      
      if (!usr) { toast.error("NIM tidak ditemukan. Pastikan User sudah terdaftar."); setLoading(false); return; }

      const targetDateTime = new Date(`${filterDate}T08:00:00`).toISOString();

      const { error } = await supabase.rpc('upsert_attendance_log_secure', {
        p_caller_id: user.id,
        p_target_user_id: usr.id,
        p_status: targetStatus,
        p_notes: targetNote || "Input Manual Oleh Staff",
        p_check_in: targetDateTime,
        p_is_verified: true,
        p_type: 'staff_manual'
      });
      if (error) throw error;
      toast.success("Absensi Manual Berhasil!"); setTargetNim(""); setTargetNote("");
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const deleteLog = async (id: number, logData: any) => {
    if (!confirm("Hapus data absen ini? Pastikan Anda tidak salah hapus!")) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_attendance_log_secure', {
        p_caller_id: user.id,
        p_log_id: id,
        p_reason: "Dihapus manual oleh Asisten",
        p_target_nim: logData.users?.username,
        p_snapshot_data: JSON.stringify(logData)
      });
      if (error) throw error;
      toast.success("Data berhasil dihapus dan riwayat tersimpan");
      fetchDeletionHistory();
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2.5 font-bold text-slate-800">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      Daftar Kehadiran
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <CardDescription className="text-xs font-medium">Rekap harian praktikan</CardDescription>
                      <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
                      {isStaffTableMode && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 shadow-sm transition-all hover:bg-blue-100">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Hadir: {totalHadir}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Live Tracking</span>
                      </div>
                    </div>
                  </div>

                  {/* BAGIAN FILTER & EXPORT UNTUK STAFF TERTENTU */}
                  {isStaff && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:border-primary/30 transition-all focus-within:ring-2 focus-within:ring-primary/10">
                        <Filter className="w-4 h-4 text-slate-400 mr-2.5" />
                        <Input
                          type="date"
                          className="border-none h-6 shadow-none focus-visible:ring-0 p-0 w-[125px] text-sm font-medium text-slate-700 bg-transparent"
                          value={filterDate}
                          onChange={(e) => setFilterDate(e.target.value)}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {hasExportAccess && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all active:scale-95 flex items-center gap-2 shadow-sm" 
                            onClick={handleExportExcel}
                          >
                            <FileDown className="w-4 h-4" /> 
                            <span className="font-semibold">Export</span>
                          </Button>
                        )}

                        {hasFullAccess && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 px-4 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                              >
                                <Trash2 className="w-4 h-4" /> 
                                <span className="font-semibold">Audit Hapus</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border-rose-100">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-3 text-rose-600 text-xl font-bold">
                                  <div className="p-2 bg-rose-50 rounded-lg">
                                    <Trash2 className="w-5 h-5"/>
                                  </div>
                                  Log Riwayat Penghapusan
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 font-medium">
                                  Daftar kehadiran yang telah dihapus oleh tim koordinator untuk keperluan audit.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="overflow-y-auto flex-1 border border-slate-100 rounded-xl mt-6 bg-slate-50/30">
                                <Table>
                                  <TableHeader className="bg-slate-100/80 sticky top-0 z-20 backdrop-blur-sm">
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu</TableHead>
                                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">NIM Target</TableHead>
                                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dihapus Oleh</TableHead>
                                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Keterangan</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {deletionHistory.length === 0 ? (
                                      <TableRow><TableCell colSpan={4} className="text-center py-16 text-slate-400 italic font-medium">Tidak ada riwayat penghapusan.</TableCell></TableRow>
                                    ) : (
                                        deletionHistory.map(h => (
                                          <TableRow key={h.id} className="hover:bg-rose-50/30 transition-colors border-rose-50/50">
                                            <TableCell className="text-[11px] font-mono font-medium text-slate-600">{new Date(h.deleted_at).toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-xs font-bold text-slate-800">{h.target_user_id}</TableCell>
                                            <TableCell className="text-xs font-semibold text-slate-700">{h.deleted_by_name || "-"}</TableCell>
                                            <TableCell className="text-[11px] text-slate-500 leading-relaxed italic">{h.reason}</TableCell>
                                          </TableRow>
                                        ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative scrollbar-thin">
                  <Table>
                    <TableHeader className="bg-slate-50/80 sticky top-0 z-20 backdrop-blur-md shadow-sm border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-6">Mahasiswa</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Info Kelas</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu & Status</TableHead>
                        {isStaff && <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Petugas</TableHead>}
                        {isStaffTableMode && <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center pr-6">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayAttendance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isStaffTableMode ? 5 : 3} className="h-48 text-center text-slate-400 italic text-sm">
                            <div className="flex flex-col items-center gap-3">
                              <CalendarCheck className="w-12 h-12 text-slate-100" />
                              <p className="font-medium">Belum ada data absensi pada tanggal ini.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayAttendance.map((log) => (
                          <TableRow key={log.id} className="group hover:bg-slate-50/80 transition-all duration-200 border-b border-slate-50">
                            <TableCell className="pl-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold text-xs border border-primary/10 group-hover:scale-110 transition-transform">
                                  {log.users?.full_name?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-slate-800">{log.users?.full_name || "Unknown"}</div>
                                  <div className="text-[11px] text-slate-500 font-mono tracking-tighter">{log.users?.username}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700">{log.users?.class_code}</span>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{log.users?.major}</span>
                                <Badge variant="secondary" className="w-fit h-4 text-[9px] px-1.5 mt-1 bg-slate-100 text-slate-600 font-semibold border-none">
                                  Shift {log.users?.shift || "-"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col gap-2 items-start">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    log.status === 'Hadir' ? 'bg-emerald-500 animate-pulse' : 
                                    log.status === 'Alpha' ? 'bg-rose-500' : 'bg-amber-500'
                                  }`}></div>
                                  <span className={`text-[11px] font-bold uppercase tracking-wide ${
                                    log.status === 'Hadir' ? 'text-emerald-700' : 
                                    log.status === 'Alpha' ? 'text-rose-700' : 'text-amber-700'
                                  }`}>
                                    {log.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                  <Clock className="w-3 h-3" />
                                  {new Date(log.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB
                                </div>
                                {log.status !== 'Hadir' && log.notes && (
                                  <p className="text-[10px] text-slate-400 italic line-clamp-1 max-w-[150px] border-l-2 border-slate-200 pl-2 mt-1">
                                    "{log.notes}"
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            {isStaff && (
                              <TableCell className="py-4">
                                {log.recorded_by_name === log.users?.full_name ? (
                                  <Badge variant="outline" className="text-[10px] font-medium bg-indigo-50/30 text-indigo-600 border-indigo-100 px-2 py-0">
                                    Mandiri
                                  </Badge>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 text-[9px] font-bold uppercase">
                                      {log.recorded_by_name?.charAt(0) || "-"}
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-600">
                                      {log.recorded_by_name || "-"}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                            )}
                            {hasDeletePower && (
                              <TableCell className="text-center pr-6 py-4">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all active:scale-90" 
                                  onClick={() => deleteLog(log.id, log)}
                                >
                                  <Trash2 className="w-4 h-4" />
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

        {!isStaff && myLogs.length > 0 && (
          <div className="space-y-5 pt-8 border-t mt-8">
            <h3 className="font-bold flex items-center gap-3 text-xl text-slate-800">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              Riwayat & Status Pengajuan Saya
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myLogs.map(log => (
                <Card key={log.id} className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 bg-white">
                  <div className={`h-1.5 w-full ${log.status === 'Hadir' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <Badge className={`${
                            log.status === 'Hadir' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
                          } text-[10px] font-bold uppercase tracking-wider w-fit`}>
                            {log.status}
                          </Badge>
                          <span className="text-[10px] font-mono text-slate-400 mt-1">
                            {new Date(log.check_in_time).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          {new Date(log.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700 leading-snug group-hover:text-primary transition-colors">{log.notes}</p>
                        
                        <div className="flex flex-wrap gap-2 mt-3">
                          {log.reschedule_status === 'pending' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0.5">
                              Menunggu ACC Jadwal
                            </Badge>
                          )}
                          {log.reschedule_status === 'approved' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0.5">
                              Jadwal Fix: {log.schedules?.day_of_week} {log.schedules?.start_time?.slice(0, 5)}
                            </Badge>
                          )}
                          {log.reschedule_status === 'rejected' && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] py-0.5">
                              Jadwal Ditolak
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-50">
                        {log.status !== 'Hadir' && adminPhone && (
                          <a href={getWaProofLink(adminPhone, log.status, log.notes)} target="_blank" rel="noreferrer" className="w-full">
                            <Button size="sm" className="bg-[#25D366] hover:bg-[#1ebd5c] text-white h-9 text-xs w-full shadow-sm active:scale-95 transition-all">
                              <Send className="w-3 h-3 mr-2" /> Kirim Bukti WA
                            </Button>
                          </a>
                        )}

                        {log.is_verified && log.status !== 'Hadir' && (
                          <>
                            {(!log.reschedule_status || log.reschedule_status === 'rejected') && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 h-9 text-xs w-full active:scale-95 transition-all">
                                    <ArrowRightLeft className="w-3 h-3 mr-2" /> Pilih Jadwal
                                  </Button>
                                </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Pilih Jadwal Pengganti</DialogTitle>
                                  <DialogDescription>
                                    Silakan pilih jadwal pengganti yang tersedia untuk menggantikan kehadiran Anda.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-2 space-y-4">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}