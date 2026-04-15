import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, UserPlus, Users, Loader2, Clock, Send, Smartphone, Pencil, Filter, CalendarDays, FileUp, FileDown, Info, HelpCircle, CheckCircle, XCircle, ArrowRight, RefreshCw, History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx"; // <--- IMPORT LIBRARY EXCEL

export default function JadwalJaga() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<any[]>([]);
  const [assistantAvailabilities, setAssistantAvailabilities] = useState<any[]>([]); 
  
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false); 
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [coordPhone, setCoordPhone] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("all"); 
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [selectedAssistantId, setSelectedAssistantId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [activityName, setActivityName] = useState(""); 
  const [activityDate, setActivityDate] = useState("");

  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveAssignmentId, setLeaveAssignmentId] = useState("");

  const taskOptions = ["Operator", "Pemateri", "PJ Absen", "PJ Pretest/Posttest", "Dokumentasi"];
  const activityOptions = [
      "Praktikum Modul 1", "Praktikum Modul 2", "Praktikum Modul 3",
      "Praktikum Modul 4", "Praktikum Modul 5", "Praktikum Modul 6",
      "Responsi / Pretest", "Posttest / Evaluasi", "Ujian Praktikum (UTS)",
      "Ujian Praktikum (UAS)", "Praktikum Susulan (Inhal)", "Persiapan / Briefing", "Lainnya"
  ];

  const checkAccess = async () => {
    if (user?.role === 'koordinator') { 
        setHasEditAccess(true); return; 
    }
    if (user?.division) {
      const { data } = await supabase.from('division_access').select('*').eq('division', user.division).eq('menu_key', '/jadwal-jaga');
      if (data && data.length > 0) setHasEditAccess(true);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    const { data: coordData } = await supabase.from('users').select('phone_number').eq('role', 'koordinator').limit(1).maybeSingle();
    if (coordData?.phone_number) setCoordPhone(coordData.phone_number);

    const { data: assignData } = await supabase.from('schedule_assignments').select(`
            id, task_role, activity_name, activity_date, status, substitute_user_id, original_user_id,
            schedule:schedule_id (id, day_of_week, start_time, end_time, title, major, class_code),
            user:user_id (id, full_name),
            original_user:original_user_id (id, full_name)
        `);
    
    if(assignData) {
        const sorted = assignData.sort((a: any, b: any) => {
            if (a.activity_date && b.activity_date) return new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
            return 0;
        });
        setAssignments(sorted);
    }

    const { data: schedData } = await supabase.from('schedules').select('*').eq('type', 'praktikum');
    setAvailableSchedules(schedData || []);

    const { data: userData } = await supabase.from('users').select('id, full_name').eq('role', 'asisten');
    setAssistants(userData || []);

    const { data: availData } = await supabase.from('assistant_availability').select('*');
    setAssistantAvailabilities(availData || []);
    
    setLoading(false);
  };

  // --- EFEK UTAMA & SUPABASE REALTIME ---
  useEffect(() => { 
    if (user) { 
        checkAccess(); 
        fetchData(); 

        // MENYALAKAN FITUR AUTO-REFRESH (REALTIME)
        const channel = supabase
          .channel('jadwal_jaga_live_updates')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'schedule_assignments' },
            (payload) => {
              console.log('Update Jadwal Jaga Diterima!', payload);
              fetchData(); // Panggil ulang untuk merefresh tabel otomatis
            }
          )
          .subscribe();

        return () => { supabase.removeChannel(channel); };
    } 
  }, [user]);

  const { activeAssignments, historyAssignments } = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0); 

    let filtered = assignments.filter(item => {
        if (!item.activity_date) return true; 
        const itemDate = new Date(item.activity_date);
        itemDate.setHours(0,0,0,0);

        if (filterType === "this_week") {
            const startOfWeek = new Date(todayDate);
            startOfWeek.setDate(todayDate.getDate() - todayDate.getDay() + 1); 
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); 
            return itemDate >= startOfWeek && itemDate <= endOfWeek;
        }
        if (filterType === "this_month") {
            return itemDate.getMonth() === todayDate.getMonth() && itemDate.getFullYear() === todayDate.getFullYear();
        }
        if (filterType === "custom") {
            const start = customStartDate ? new Date(customStartDate).setHours(0,0,0,0) : null;
            const end = customEndDate ? new Date(customEndDate).setHours(23,59,59,999) : null;
            if (start && itemDate.getTime() < start) return false;
            if (end && itemDate.getTime() > end) return false;
        }
        return true;
    });

    const active = filtered.filter(item => {
        if(!item.activity_date) return true;
        const itemDate = new Date(item.activity_date).setHours(0,0,0,0);
        return itemDate >= todayDate.getTime();
    });

    const history = filtered.filter(item => {
        if(!item.activity_date) return false;
        const itemDate = new Date(item.activity_date).setHours(0,0,0,0);
        return itemDate < todayDate.getTime();
    });

    return { activeAssignments: active, historyAssignments: history };
  }, [assignments, filterType, customStartDate, customEndDate]);

  const smartAssistantList = useMemo(() => {
      if (!selectedScheduleId) return { available: assistants, unavailable: [] };
      const targetSched = availableSchedules.find(s => s.id.toString() === selectedScheduleId);
      if (!targetSched) return { available: assistants, unavailable: [] };

      const availableAst: any[] = [];
      const unavailableAst: any[] = [];

      assistants.forEach(ast => {
          const isFree = assistantAvailabilities.some(avail => {
              if (avail.user_id !== ast.id || avail.day_of_week !== targetSched.day_of_week) return false;
              return avail.start_time <= targetSched.start_time && avail.end_time >= targetSched.end_time;
          });

          if (isFree) availableAst.push(ast);
          else unavailableAst.push(ast);
      });

      return { available: availableAst, unavailable: unavailableAst };
  }, [selectedScheduleId, assistants, availableSchedules, assistantAvailabilities]);

  const openAddDialog = () => {
    setIsEditMode(false); setEditingId(null); setSelectedScheduleId(""); setSelectedAssistantId("");
    setSelectedRole(""); setActivityName(""); setActivityDate(""); setIsDialogOpen(true);
  };

  const openEditDialog = (item: any) => {
    setIsEditMode(true); setEditingId(item.id); setSelectedScheduleId(item.schedule.id.toString());
    setSelectedAssistantId(item.user.id.toString()); setSelectedRole(item.task_role);
    setActivityName(item.activity_name || ""); setActivityDate(item.activity_date || ""); setIsDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if(!selectedScheduleId || !selectedAssistantId || !selectedRole || !activityDate || !activityName) return toast.error("Lengkapi semua data!");
    
    // SECURE CHECK: Re-verify access inside handler
    if (!hasEditAccess) {
        toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk mengedit jadwal jaga." });
        return;
    }

    setLoading(true);
    try {
        const payload = {
            schedule_id: parseInt(selectedScheduleId), user_id: parseInt(selectedAssistantId),
            task_role: selectedRole, activity_name: activityName, activity_date: activityDate
        };

        if (isEditMode && editingId) {
            const { error } = await supabase.from('schedule_assignments').update(payload).eq('id', editingId);
            if (error) throw error; toast.success("Petugas berhasil diperbarui!");
        } else {
            const { error } = await supabase.from('schedule_assignments').insert(payload);
            if (error) throw error; toast.success("Petugas ditambahkan!");
        }
        setIsDialogOpen(false);
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if(!confirm("Hapus petugas ini?")) return;
    
    // SECURE CHECK
    if (!hasEditAccess) {
        toast.error("Akses Ditolak", { description: "Hanya Koordinator atau Divisi berwenang yang dapat menghapus." });
        return;
    }

    await supabase.from('schedule_assignments').delete().eq('id', id); 
  };


  // ==========================================
  // LOGIKA EXCEL: IMPORT, EXPORT, DAN TEMPLATE
  // ==========================================

  const handleDownloadTemplateExcel = () => {
      // Membuat data template dummy
      const templateData = [{
          "Tanggal Kegiatan": "2026-03-20",
          "Nama Kegiatan": "Praktikum Modul 1",
          "Jurusan": "Teknik Elektro",
          "Kelas": "A",
          "Nama Asisten": "Budi Asisten",
          "Tugas": "Operator"
      }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Plotting");
      XLSX.writeFile(wb, "Template_Plotting_Asisten.xlsx");
  };

  const handleExportExcel = () => {
      // Format data agar cantik di Excel
      const formatDataForExcel = (dataList: any[]) => dataList.map(item => ({
          "Tanggal": item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID') : "-",
          "Kegiatan": item.activity_name || "-",
          "Hari": item.schedule?.day_of_week || "-",
          "Jam": item.schedule?.start_time?.slice(0,5) || "-",
          "Jurusan": item.schedule?.major || "-",
          "Kelas": item.schedule?.class_code || "-",
          "Asisten": item.user?.full_name || "-",
          "Tugas": item.task_role || "-",
          "Status Jaga": item.status || "aktif"
      }));

      const activeData = formatDataForExcel(activeAssignments);
      const historyData = formatDataForExcel(historyAssignments);

      const wb = XLSX.utils.book_new();
      
      // Buat Sheet 1: Jadwal Aktif
      const wsActive = XLSX.utils.json_to_sheet(activeData.length > 0 ? activeData : [{"Message": "Tidak ada jadwal aktif"}]);
      XLSX.utils.book_append_sheet(wb, wsActive, "Jadwal Aktif");

      // Buat Sheet 2: Riwayat Jaga
      const wsHistory = XLSX.utils.json_to_sheet(historyData.length > 0 ? historyData : [{"Message": "Tidak ada riwayat jaga"}]);
      XLSX.utils.book_append_sheet(wb, wsHistory, "Riwayat Jaga");

      // Simpan File
      XLSX.writeFile(wb, `Rekap_Jadwal_Jaga_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("File Excel berhasil di-download!");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // SECURE CHECK
      if (!hasEditAccess) {
          toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk mengimport jadwal." });
          return;
      }

      setLoading(true);

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0]; // Ambil sheet pertama
              const ws = wb.Sheets[wsname];
              const data = XLSX.utils.sheet_to_json(ws); // Ubah sheet jadi array JSON
              
              const getDayNameIndo = (dateStr: string) => {
                  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                  const date = new Date(dateStr);
                  return days[date.getDay()];
              };

              const errors: string[] = [];
              const payload = data.map((row: any, index: number) => {
                  const assistantName = row['Nama Asisten'] || row['nama_asisten'];
                  const major = row['Jurusan'] || row['jurusan'];
                  const classCode = row['Kelas'] || row['kelas'];
                  const activityDate = row['Tanggal Kegiatan'] || row['tanggal_kegiatan'];
                  
                  if (!assistantName || !classCode || !major || !activityDate) return null;

                  const dayName = getDayNameIndo(activityDate);

                  // 1. Cari Assistant ID berdasarkan Nama
                  const assistant = assistants.find(a => a.full_name?.toLowerCase().trim() === String(assistantName).toLowerCase().trim());
                  
                  // 2. Cari Schedule ID berdasarkan Jurusan + Kelas + Hari (Sesuai Tanggal)
                  const schedule = availableSchedules.find(s => 
                      s.major?.toLowerCase().trim() === String(major).toLowerCase().trim() &&
                      s.class_code?.toLowerCase().trim() === String(classCode).toLowerCase().trim() &&
                      s.day_of_week?.toLowerCase().trim() === dayName.toLowerCase()
                  );

                  if (!assistant) {
                      errors.push(`Baris ${index + 2}: Asisten "${assistantName}" tidak ditemukan.`);
                      return null;
                  }
                  if (!schedule) {
                      errors.push(`Baris ${index + 2}: Jadwal "${major} Kelas ${classCode}" tidak ditemukan di hari ${dayName}.`);
                      return null;
                  }

                  return {
                      activity_date: activityDate,
                      activity_name: row['Nama Kegiatan'] || row['nama_kegiatan'],
                      schedule_id: schedule.id,
                      user_id: assistant.id,
                      task_role: row['Tugas'] || row['tugas'],
                      status: 'aktif'
                  };
              }).filter(Boolean);

              if (errors.length > 0) {
                  toast.error("Gagal Import", {
                      description: (
                          <div className="max-h-[150px] overflow-auto">
                              {errors.slice(0, 3).map((err, i) => <div key={i}>{err}</div>)}
                              {errors.length > 3 && <div>...dan {errors.length - 3} lainnya.</div>}
                          </div>
                      )
                  });
              }

              if (payload.length > 0) {
                  const { error } = await supabase.from('schedule_assignments').insert(payload);
                  if (error) throw error;
                  toast.success(`${payload.length} jadwal berhasil diimpor dengan deteksi otomatis!`);
                  setIsImportDialogOpen(false);
              } else if (errors.length === 0) { 
                  toast.error("Gagal", { description: "Format Excel salah atau data tidak lengkap." }); 
              }
          } catch (err: any) { 
              toast.error("Gagal mengimpor Excel: " + err.message); 
          } finally { 
              setLoading(false); 
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; // Reset input file
  };


  // --- LOGIKA SWAP ---
  const handleRequestLeave = async () => {
    if(!leaveAssignmentId) return toast.error("Pilih jadwal yang mau di-swap!");
    if(!leaveReason) return toast.error("Alasan harus diisi untuk Koordinator!");
    
    setSubmittingLeave(true);
    try {
        const { error: updateError } = await supabase
            .from('schedule_assignments')
            .update({ status: 'mencari_pengganti' })
            .eq('id', parseInt(leaveAssignmentId));
        if (updateError) throw updateError;

        if (coordPhone) {
            let cleanPhone = coordPhone.replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Halo Koordinator, saya *${user?.full_name}* izin tidak dapat jaga dan sedang mencari pengganti (Swap).\nAlasan: ${leaveReason}`)}`, '_blank');
            toast.success("Jadwal dilempar ke Bursa! Mengalihkan ke WhatsApp...");
        } else {
            toast.success("Berhasil! Jadwal sekarang masuk ke bursa pengganti."); 
        }
        setLeaveReason(""); setLeaveAssignmentId(""); 
    } catch (err: any) { toast.error(err.message); } finally { setSubmittingLeave(false); }
  };

  const handleOfferSubstitute = async (assignmentId: number) => {
      if (!confirm("Anda yakin bersedia menggantikan jadwal ini?")) return;
      try {
          const { error } = await supabase
              .from('schedule_assignments')
              .update({ status: 'menunggu_persetujuan', substitute_user_id: user?.id })
              .eq('id', assignmentId);
          if (error) throw error;
          toast.success("Berhasil menawarkan diri! Menunggu persetujuan Koordinator.");
      } catch (err: any) { toast.error("Gagal menawarkan diri: " + err.message); }
  };

  const handleApproveSwap = async (assignmentId: number, substituteId: number, originalUserId: number) => {
      // SECURE CHECK: Hanya Koordinator yang boleh approve swap secara resmi lewat UI admin
      if (user?.role !== 'koordinator' && user?.role !== 'asisten') {
          toast.error("Akses Ditolak");
          return;
      }

      if(!confirm("Setujui pertukaran jadwal ini?")) return;
      try {
          const { error } = await supabase
              .from('schedule_assignments')
              .update({ 
                  user_id: substituteId, 
                  original_user_id: originalUserId, 
                  substitute_user_id: null, 
                  status: 'aktif' 
              })
              .eq('id', assignmentId);
          if (error) throw error;
          toast.success("Pertukaran jadwal berhasil disetujui!");
      } catch (err: any) { toast.error("Gagal menyetujui: " + err.message); }
  };

  const handleRejectSwap = async (assignmentId: number) => {
      if(!confirm("Tolak penawaran ini dan kembalikan jadwal awal?")) return;
      try {
          const { error } = await supabase
              .from('schedule_assignments')
              .update({ substitute_user_id: null, status: 'mencari_pengganti' })
              .eq('id', assignmentId);
          if (error) throw error;
          toast.info("Penawaran ditolak. Jadwal dikembalikan ke sebelumnya.");
      } catch (err: any) { toast.error("Gagal menolak: " + err.message); }
  };

  const handleCancelSwapKoordinator = async (assignmentId: number) => {
      if(!confirm("Batalkan pencarian dan paksa jadwal kembali aktif ke asisten awal?")) return;
      try {
          const { error } = await supabase
              .from('schedule_assignments')
              .update({ substitute_user_id: null, status: 'aktif' })
              .eq('id', assignmentId);
          if (error) throw error;
          toast.success("Pencarian dibatalkan. Jadwal kembali aktif.");
      } catch (err: any) { toast.error("Gagal membatalkan: " + err.message); }
  };


  // --- KOMPONEN TABEL UTAMA ---
  const renderTable = (dataList: any[], isHistory: boolean = false) => (
      <Table>
          <TableHeader>
              <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kegiatan & Waktu</TableHead>
                  <TableHead>Jurusan & Kelas</TableHead>
                  <TableHead>Asisten</TableHead>
                  <TableHead>Status / Tugas</TableHead>
                  {hasEditAccess && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
          </TableHeader>
          <TableBody>
              {dataList.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada data.</TableCell></TableRow>
              ) : (
                  dataList.map((item) => (
                      <TableRow key={item.id} className={isHistory ? "opacity-75 bg-gray-50/50" : (item.status === 'mencari_pengganti' || item.status === 'menunggu_persetujuan' ? "bg-yellow-50/50" : "")}>
                          <TableCell className="font-medium">
                              {item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : "-"}
                          </TableCell>
                          
                          <TableCell>
                              <div className="font-bold text-sm">{item.activity_name || "Praktikum"}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3"/> {item.schedule?.day_of_week}, {item.schedule?.start_time?.slice(0,5)}
                              </div>
                          </TableCell>

                          <TableCell>
                               <div className="font-medium text-sm">{item.schedule?.major || "-"}</div>
                               <div className="text-xs text-muted-foreground mt-1">Kelas <span className="font-bold bg-gray-100 px-1 py-0.5 rounded border">{item.schedule?.class_code || "-"}</span></div>
                          </TableCell>

                          <TableCell className={item.status !== 'aktif' ? "text-yellow-700 font-medium" : ""}>
                              {item.user?.full_name}
                          </TableCell>

                          <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                  <Badge variant={isHistory ? "outline" : "secondary"}>{item.task_role}</Badge>
                                  {item.status === 'mencari_pengganti' && <Badge className="bg-yellow-500 hover:bg-yellow-600 text-[10px]">Cari Pengganti</Badge>}
                                  {item.status === 'menunggu_persetujuan' && <Badge className="bg-blue-500 hover:bg-blue-600 text-[10px]">Menunggu Approval</Badge>}
                              </div>
                          </TableCell>
                          
                          {hasEditAccess && (
                              <TableCell className="text-right">
                                 <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="text-blue-500 hover:bg-blue-50 h-8 w-8" onClick={() => openEditDialog(item)}><Pencil className="w-4 h-4"/></Button>
                                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 h-8 w-8" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4"/></Button>
                                 </div>
                              </TableCell>
                          )}
                      </TableRow>
                  ))
              )}
          </TableBody>
      </Table>
  );

  const myActiveAssignments = activeAssignments.filter(item => item.user?.id === user?.id && (!item.status || item.status === 'aktif'));
  const swapRequests = activeAssignments.filter(item => item.status === 'mencari_pengganti');
  const mySwapRequestsStatus = activeAssignments.filter(item => item.user?.id === user?.id && (item.status === 'mencari_pengganti' || item.status === 'menunggu_persetujuan'));
  const pendingApprovals = activeAssignments.filter(item => item.status === 'menunggu_persetujuan');
  
  const swappedHistory = assignments.filter(item => item.original_user_id != null);

  return (
    <DashboardLayout>
       <div className="space-y-6">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="text-primary"/> Plotting Jadwal Jaga
                </h1>
                {/* Indikator Realtime Live */}
                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200 animate-pulse mt-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block"></span> Live Update
                </Badge>
            </div>
            
            {hasEditAccess && (
                <div className="flex flex-wrap gap-2">
                    {/* TOMBOL EXPORT EXCEL */}
                    <Button variant="outline" className="border-blue-600 text-blue-700 hover:bg-blue-50" onClick={handleExportExcel}>
                        <FileDown className="w-4 h-4 mr-2"/> Export Excel
                    </Button>

                    {/* DIALOG IMPORT EXCEL */}
                    <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                        <DialogTrigger asChild><Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50"><FileUp className="w-4 h-4 mr-2"/> Import Excel</Button></DialogTrigger>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader><DialogTitle>Import Data Plotting Asisten (Excel)</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                        <p className="font-semibold mb-1">Cara Menggunakan Fitur Import Excel:</p>
                                        <ol className="list-decimal list-inside space-y-1 ml-1">
                                            <li>Download template Excel menggunakan tombol di bawah.</li>
                                            <li>Sistem baru: Gunakan kolom <strong>Jurusan</strong> dan <strong>Kelas</strong>.</li>
                                            <li>Sistem akan otomatis mendeteksi Hari berdasarkan <strong>Tanggal Kegiatan</strong>.</li>
                                            <li>Pastikan Nama Asisten sesuai dengan yang terdaftar.</li>
                                        </ol>
                                        <Button size="sm" onClick={handleDownloadTemplateExcel} className="mt-3 bg-blue-600 hover:bg-blue-700"><FileDown className="w-4 h-4 mr-2"/> Download Template Excel</Button>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <Label className="mb-2 block font-semibold">Upload File Excel (.xlsx) yang sudah diisi:</Label>
                                    <Input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={loading} />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <Button onClick={openAddDialog}><UserPlus className="w-4 h-4 mr-2"/> Tambah Petugas</Button>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{isEditMode ? "Edit Penugasan Asisten" : "Tugaskan Asisten"}</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Tanggal Bertugas</Label><Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Kegiatan</Label><Select value={activityName} onValueChange={setActivityName}><SelectTrigger><SelectValue placeholder="Pilih..."/></SelectTrigger><SelectContent>{activityOptions.map(act => <SelectItem key={act} value={act}>{act}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Target Kelas</Label>
                                    <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}><SelectTrigger><SelectValue placeholder="Pilih Kelas..."/></SelectTrigger><SelectContent>{availableSchedules.map(s => (<SelectItem key={s.id} value={s.id.toString()}>{s.day_of_week}, {s.start_time.slice(0,5)} - {s.title} ({s.major} Kelas {s.class_code})</SelectItem>))}</SelectContent></Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Asisten</Label>
                                        <Select value={selectedAssistantId} onValueChange={setSelectedAssistantId} disabled={!selectedScheduleId}>
                                            <SelectTrigger><SelectValue placeholder="Pilih..."/></SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup><SelectLabel className="bg-green-100 text-green-800">✅ Bisa Hadir (Jadwal Kosong)</SelectLabel>{smartAssistantList.available.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.full_name}</SelectItem>)}</SelectGroup>
                                                <SelectGroup className="mt-2"><SelectLabel className="bg-red-50 text-red-700">❌ Bentrok / Tidak Ada Info</SelectLabel>{smartAssistantList.unavailable.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.full_name}</SelectItem>)}</SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tugas</Label>
                                        <Select value={selectedRole} onValueChange={setSelectedRole}><SelectTrigger><SelectValue placeholder="Pilih..."/></SelectTrigger><SelectContent>{taskOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                                <Button onClick={handleSaveAssignment} disabled={loading} className="w-full mt-2">{loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Simpan Perubahan"}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
         </div>

         {/* TOOLBAR FILTER */}
         <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded border w-fit shadow-sm">
             <Filter className="w-4 h-4 text-muted-foreground ml-2"/>
             <Select value={filterType} onValueChange={setFilterType}>
                 <SelectTrigger className="w-[160px] border-none h-8 bg-transparent shadow-none focus:ring-0 font-medium"><SelectValue placeholder="Filter Waktu" /></SelectTrigger>
                 <SelectContent>
                     <SelectItem value="all">Semua Waktu</SelectItem>
                     <SelectItem value="this_week">Minggu Ini</SelectItem>
                     <SelectItem value="this_month">Bulan Ini</SelectItem>
                     <SelectItem value="custom">Range Tanggal...</SelectItem>
                 </SelectContent>
             </Select>
             {filterType === 'custom' && (
                 <div className="flex items-center gap-2 border-l pl-3 ml-1">
                     <Input type="date" className="h-8 text-xs w-[120px]" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                     <span className="text-muted-foreground text-xs font-medium">s/d</span>
                     <Input type="date" className="h-8 text-xs w-[120px]" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
                 </div>
             )}
         </div>

         <Tabs defaultValue="active">
            <TabsList className={`grid w-full ${hasEditAccess ? 'lg:w-[500px] grid-cols-3' : 'lg:w-[350px] grid-cols-2'} mb-4`}>
                <TabsTrigger value="active">Jadwal Aktif</TabsTrigger>
                {hasEditAccess && <TabsTrigger value="history">Riwayat Jaga</TabsTrigger>}
                <TabsTrigger value="izin">Perizinan Jaga</TabsTrigger>
            </TabsList>

            {/* TAB 1: JADWAL AKTIF */}
            <TabsContent value="active">
                <Card><CardContent className="pt-6">{renderTable(activeAssignments)}</CardContent></Card>
            </TabsContent>

            {/* TAB 2: RIWAYAT JAGA */}
            {hasEditAccess && (
                <TabsContent value="history" className="space-y-6">
                    <Card className="border-l-4 border-l-blue-500 shadow-sm opacity-95">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-700">
                                <History className="w-5 h-5"/> Riwayat Pertukaran (Swap) Asisten
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pertukaran Asisten</TableHead>
                                        <TableHead>Tanggal Pertukaran</TableHead>
                                        <TableHead>Jadwal & Modul</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {swappedHistory.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Belum ada riwayat pertukaran asisten.</TableCell></TableRow>
                                    ) : (
                                        swappedHistory.map((item) => (
                                            <TableRow key={item.id} className="bg-gray-50/50">
                                                <TableCell>
                                                    <div className="font-bold text-sm text-gray-800">{item.original_user?.full_name}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                        <ArrowRight className="w-3 h-3 text-blue-500"/> Digantikan oleh: <span className="font-semibold text-green-700">{item.user?.full_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium">{item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : "-"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-sm text-blue-700">{item.schedule?.day_of_week}, {item.schedule?.start_time?.slice(0,5)}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">{item.activity_name} ({item.schedule?.major} Kls {item.schedule?.class_code})</div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none shadow-none">
                                                        Disetujui & Fix
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                                <CalendarDays className="w-4 h-4"/> Data Penugasan Masa Lalu (Selesai)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>{renderTable(historyAssignments, true)}</CardContent>
                    </Card>
                </TabsContent>
            )}

            {/* TAB 3: PERIZINAN & BURSA */}
            <TabsContent value="izin" className="space-y-6">
                
                {/* WIDGET KHUSUS KOORDINATOR: PERSETUJUAN SWAP */}
                {hasEditAccess && pendingApprovals.length > 0 && (
                    <Card className="border-blue-200 shadow-md">
                        <CardHeader className="bg-blue-50/70 border-b border-blue-100 pb-3">
                            <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                                <CheckCircle className="w-5 h-5"/> Menunggu Persetujuan Pertukaran (Swap) Anda
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pertukaran Asisten</TableHead>
                                        <TableHead>Jadwal Kelas & Tugas</TableHead>
                                        <TableHead className="text-right">Aksi Koordinator</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingApprovals.map(item => {
                                        const substituteName = assistants.find(a => a.id === item.substitute_user_id)?.full_name || "Asisten Baru";
                                        return (
                                            <TableRow key={item.id} className="bg-blue-50/20">
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium text-red-600 line-through decoration-red-300">{item.user?.full_name}</span>
                                                        <ArrowRight className="w-4 h-4 text-muted-foreground"/>
                                                        <span className="font-bold text-green-700">{substituteName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{item.activity_name} ({item.schedule?.major} Kls {item.schedule?.class_code})</div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : ""} • Jam {item.schedule?.start_time?.slice(0,5)} • <span className="font-bold">{item.task_role}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleRejectSwap(item.id)}>
                                                            <XCircle className="w-4 h-4 mr-1"/> Tolak
                                                        </Button>
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleApproveSwap(item.id, item.substitute_user_id, item.user?.id)}>
                                                            <CheckCircle className="w-4 h-4 mr-1"/> Setujui Swap
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* MARKETPLACE: BURSA JADWAL KOSONG */}
                <Card className="border-yellow-200 shadow-sm">
                    <CardHeader className="bg-yellow-50/50 border-b border-yellow-100 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
                            <HelpCircle className="w-5 h-5"/> Tabel Pengganti Jadwal (Dicari Pengganti)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Peminta Izin</TableHead>
                                    <TableHead>Waktu & Kelas</TableHead>
                                    <TableHead>Tugas</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {swapRequests.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Tidak ada jadwal yang membutuhkan pengganti saat ini.</TableCell></TableRow>
                                ) : (
                                    swapRequests.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-bold text-yellow-900">{item.user?.full_name}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.activity_name} ({item.schedule?.major} Kls {item.schedule?.class_code})</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : ""} • Jam {item.schedule?.start_time?.slice(0,5)}
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{item.task_role}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                {item.user?.id === user?.id ? (
                                                    <Badge className="bg-yellow-100 text-yellow-800">Menunggu Pengganti...</Badge>
                                                ) : (
                                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleOfferSubstitute(item.id)}>
                                                        Tawarkan Diri
                                                    </Button>
                                                )}
                                                {hasEditAccess && (
                                                    <Button size="sm" variant="outline" className="ml-2 h-8 px-2 text-gray-500 hover:text-red-600" onClick={() => handleCancelSwapKoordinator(item.id)}>
                                                        <RotateCcw className="w-3 h-3"/>
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* FORM SWAP DAN STATUS SWAP SAYA */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1 h-fit">
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Lempar Jadwal ke Tabel</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Jadwal yang Ditinggalkan</Label>
                                <Select value={leaveAssignmentId} onValueChange={setLeaveAssignmentId}>
                                    <SelectTrigger><SelectValue placeholder="Pilih jadwal aktif Anda..."/></SelectTrigger>
                                    <SelectContent>
                                        {myActiveAssignments.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center italic">Tidak ada jadwal aktif</div>
                                        ) : (
                                            myActiveAssignments.map(item => (
                                                <SelectItem key={item.id} value={item.id.toString()}>
                                                    {item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : ""} - {item.activity_name} ({item.schedule?.start_time?.slice(0,5)})
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Alasan (Untuk Koordinator)</Label>
                                <Input placeholder="Contoh: Sakit demam..." value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
                            </div>
                            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleRequestLeave} disabled={submittingLeave}>
                                {submittingLeave ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <><Smartphone className="w-4 h-4 mr-2" />Kirim Alasan Swap</>}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4"/> Status Permintaan Swap Saya</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Jadwal Dilepas</TableHead>
                                        <TableHead>Kandidat Pengganti</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mySwapRequestsStatus.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Anda belum/tidak memiliki permintaan pertukaran jadwal yang sedang aktif.</TableCell></TableRow>
                                    ) : (
                                        mySwapRequestsStatus.map(item => {
                                            const subName = assistants.find(a => a.id === item.substitute_user_id)?.full_name || "-";
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-xs">
                                                        <div className="font-bold">{item.activity_name}</div>
                                                        <div className="text-muted-foreground">{item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long'}) : ""}</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">
                                                        {item.status === 'menunggu_persetujuan' ? (
                                                            <span className="text-green-700 font-bold">{subName}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground italic">Menunggu...</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={item.status === 'menunggu_persetujuan' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>
                                                            {item.status === 'menunggu_persetujuan' ? 'Menunggu ACC Koordinator' : 'Mencari Pengganti'}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
         </Tabs>
       </div>
    </DashboardLayout>
  );
}