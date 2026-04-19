import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Wand2, Calendar, Briefcase, RefreshCw, ArrowRight, Trash2, RotateCcw, DownloadCloud, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

export default function ManajemenKelas() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  
  // State Data Plotting
  const [availableAssistants, setAvailableAssistants] = useState<any[]>([]); 
  const [assignedAssistants, setAssignedAssistants] = useState<any[]>([]);   
  const [students, setStudents] = useState<any[]>([]);                       
  
  // State Dialog, Loading & Filter
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAssistantId, setSelectedAssistantId] = useState("");
  
  const [filterDay, setFilterDay] = useState("all");
  const [filterMajor, setFilterMajor] = useState("all");
  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [distributionMode, setDistributionMode] = useState("selang-seling");

  // --- CEK HAK AKSES ---
  const checkAccess = async () => {
      if (!user) return;
      const { data, error } = await supabase.rpc('check_menu_access_secure', { 
          p_viewer_id: user.id, 
          p_menu_key: '/manajemen-kelas' 
      });
      if (!error && data) setHasEditAccess(true);
  };

  // --- 1. FETCH DATA DARI JADWAL ---
  const fetchGroups = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_schedules_secure', { p_viewer_id: user.id });
    const praktikumOnly = (data || []).filter((s: any) => s.type === 'praktikum' && s.status === 'approved');
    setSchedules(praktikumOnly);
  };

  useEffect(() => { 
      fetchGroups(); 
      if(user) checkAccess();
  }, [user]);

  // --- 2. LOGIKA DETAIL KELAS ---
  const fetchGroupDetails = async (schedule: any) => {
    if (!user) return;
    setLoading(true);
    setSelectedGroup(schedule);

    try {
        // 2.1 Fetch Assigned Assistants via RPC
        const { data: assigned } = await supabase.rpc('get_group_assistants_secure', { 
          p_viewer_id: user.id, 
          p_schedule_id: schedule.id 
        });
        
        const formattedAssigned = (assigned || []).map((a: any) => ({
          ...a,
          users: { full_name: a.assistant_name }
        }));
        setAssignedAssistants(formattedAssigned);

        // 2.2 Fetch Students via RPC
        const { data: mhs } = await supabase.rpc('get_group_members_secure', { 
          p_viewer_id: user.id, 
          p_schedule_id: schedule.id 
        });
        
        const formattedStudents = (mhs || []).map((s: any) => ({
          ...s,
          users: { full_name: s.student_name, nim: s.student_nim },
          assistant: { full_name: s.assistant_name }
        }));
        setStudents(formattedStudents);

        // 2.3 Fetch Available Assistants via RPC
        const { data: available } = await supabase.rpc('get_assistant_availability_secure', {
          p_viewer_id: user.id,
          p_day: schedule.day_of_week,
          p_start: schedule.start_time,
          p_end: schedule.end_time
        });

        const assignedIds = formattedAssigned.map((a: any) => a.assistant_id);
        const cleanList = (available || []).filter((a: any) => !assignedIds.includes(a.user_id)).map((a: any) => ({
          ...a,
          users: { full_name: a.user_full_name }
        }));
        setAvailableAssistants(cleanList);

    } catch (err: any) {
        toast.error("Terjadi kesalahan sistem: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  // --- 3. SYNC MAHASISWA OTOMATIS ---
  const handleSyncStudents = async () => {
    if(!selectedGroup || !user) return;
    
    if (!hasEditAccess) {
        toast.error("Akses Ditolak");
        return;
    }

    setLoading(true);
    try {
        const { error } = await supabase.rpc('sync_students_to_group_secure', { 
            p_caller_id: user.id,
            p_schedule_id: selectedGroup.id,
            p_major: selectedGroup.major,
            p_class_code: selectedGroup.class_code
        });

        if (error) throw error;
        toast.success(`Proses sinkronisasi praktikan selesai!`);
        fetchGroupDetails(selectedGroup); 

    } catch (err: any) { toast.error("Gagal sync: " + err.message); } finally { setLoading(false); }
  };

  // --- 4. BAGI RATA (AUTO DISTRIBUTE) ---
  const handleDistributeStudents = async () => {
    if (assignedAssistants.length === 0) return toast.error("Masukkan tim asisten dulu!");
    if (students.length === 0) return toast.error("Sync data mahasiswa dulu!");

    if (!hasEditAccess) {
        toast.error("Akses Ditolak");
        return;
    }

    setLoading(true);
    try {
        const assistantIds = assignedAssistants.map(a => a.assistant_id);
        let updates = [];

        if (distributionMode === "selang-seling") {
            updates = students.map((s, index) => ({
                id: s.id, 
                assistant_id: assistantIds[index % assistantIds.length]
            }));
        } else {
            const groupSize = Math.ceil(students.length / assistantIds.length);
            updates = students.map((s, index) => {
                const asstIndex = Math.floor(index / groupSize);
                const safeAsstIndex = Math.min(asstIndex, assistantIds.length - 1);
                return {
                    id: s.id, 
                    assistant_id: assistantIds[safeAsstIndex]
                };
            });
        }

        const { error } = await supabase.rpc('update_group_members_batch_secure', {
            p_caller_id: user?.id,
            p_updates: updates
        });
        if (error) throw error;

        toast.success("Mahasiswa berhasil dibagi rata!");
        fetchGroupDetails(selectedGroup);
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  // --- 5. RESET PLOTTING (UNDO SEMUA) ---
  const handleResetPlotting = async () => {
    if(!confirm("Yakin ingin menghapus semua pembagian asisten? Data mahasiswa tidak akan hilang.")) return;
    
    if (!hasEditAccess) {
        toast.error("Akses Ditolak");
        return;
    }

    setLoading(true);
    try {
        const { error } = await supabase.rpc('reset_group_plotting_secure', {
            p_caller_id: user?.id,
            p_schedule_id: selectedGroup.id
        });
        if(error) throw error;
        toast.success("Plotting berhasil di-reset!");
        fetchGroupDetails(selectedGroup);
    } catch (err:any) { toast.error(err.message); } finally { setLoading(false); }
  };

  // --- 6. UPDATE MANUAL PER MAHASISWA ---
  const handleUpdateStudentAssistant = async (memberId: number, newAssistantId: string) => {
    if (!hasEditAccess) {
        toast.error("Akses Ditolak");
        return;
    }

    setStudents(prev => prev.map(s => s.id === memberId ? {...s, assistant_id: newAssistantId} : s));
    const { error } = await supabase.rpc('update_group_members_batch_secure', {
        p_caller_id: user?.id,
        p_updates: [{ id: memberId, assistant_id: newAssistantId === "unassigned" ? null : parseInt(newAssistantId) }]
    });
    
    if (error) {
        toast.error("Gagal update: " + error.message);
        fetchGroupDetails(selectedGroup);
    } else {
        toast.success("Asisten diperbarui");
    }
  };

  // --- 7. TAMBAH TIM ASISTEN ---
  const handleAddAssistant = async () => {
    if (!selectedAssistantId || !user) return;

    if (!hasEditAccess) {
        toast.error("Akses Ditolak");
        return;
    }

    const { error } = await supabase.rpc('upsert_group_assistant_secure', {
        p_caller_id: user.id,
        p_schedule_id: selectedGroup.id,
        p_assistant_id: parseInt(selectedAssistantId)
    });
    
    if (error) toast.error(error.message);
    else { fetchGroupDetails(selectedGroup); setSelectedAssistantId(""); }
  };

  // ==========================================
  // FITUR FILTER & EXPORT
  // ==========================================
  const { uniqueDays, uniqueMajors } = useMemo(() => {
      const days = new Set<string>();
      const majors = new Set<string>();
      schedules.forEach(item => {
          if (item.day_of_week) days.add(item.day_of_week);
          if (item.major) majors.add(item.major);
      });
      return { uniqueDays: Array.from(days).sort(), uniqueMajors: Array.from(majors).sort() };
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
      return schedules.filter(item => {
          const matchDay = filterDay === "all" || item.day_of_week === filterDay;
          const matchMajor = filterMajor === "all" || item.major === filterMajor;
          return matchDay && matchMajor;
      });
  }, [schedules, filterDay, filterMajor]);

  // --- Export Semua Data ---
  const handleExportSemuaKelompok = async () => {
      const loadingToast = toast.loading("Menyiapkan file Excel Keseluruhan...");
      try {
          const { data, error } = await supabase.rpc('get_all_group_members_secure', { p_viewer_id: user.id });

          if (error) throw error;
          if (!data || data.length === 0) {
              toast.dismiss(loadingToast); return toast.error("Data plotting belum tersedia.");
          }

          const excelData = data.map((row: any) => ({
              "Jurusan": row.schedule_major || "-",
              "Kelas": row.schedule_class_code || "-",
              "Hari": row.schedule_day || "-",
              "Jam": `${row.schedule_start?.slice(0,5)} - ${row.schedule_end?.slice(0,5)}`,
              "Modul Praktikum": row.schedule_title || "-",
              "Asisten Pembimbing": row.assistant_name || "Belum ditentukan",
              "NIM Praktikan": row.student_nim || "-",
              "Nama Praktikan": row.student_name || "-"
          }));

          excelData.sort((a, b) => {
              if (a.Jurusan !== b.Jurusan) return a.Jurusan.localeCompare(b.Jurusan);
              if (a.Kelas !== b.Kelas) return a.Kelas.localeCompare(b.Kelas);
              return a["Asisten Pembimbing"].localeCompare(b["Asisten Pembimbing"]);
          });

          const finalData = excelData.map((row, idx) => ({ "No": idx + 1, ...row }));
          const worksheet = XLSX.utils.json_to_sheet(finalData);
          worksheet['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];
          
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Seluruh Plotting");
          XLSX.writeFile(workbook, `Data_Seluruh_Plotting_${new Date().toISOString().split('T')[0]}.xlsx`);

          toast.dismiss(loadingToast); toast.success("Excel Keseluruhan diunduh.");
      } catch (err: any) {
          toast.dismiss(loadingToast); toast.error("Gagal Export: " + err.message);
      }
  };

  // --- Export Satu Kelas ---
  const handleExportPerKelas = () => {
      if(!selectedGroup || students.length === 0) return toast.error("Data mahasiswa di kelas ini masih kosong.");
      
      const cleanData = students.map((s, idx) => ({
          "No": idx + 1,
          "Asisten Pembimbing": s.assistant?.full_name || "Belum ditentukan",
          "NIM Praktikan": s.users?.nim || "-",
          "Nama Praktikan": s.users?.full_name || "-"
      }));

      // Urutkan by Asisten -> Nama Mahasiswa
      cleanData.sort((a, b) => {
          if (a["Asisten Pembimbing"] !== b["Asisten Pembimbing"]) return a["Asisten Pembimbing"].localeCompare(b["Asisten Pembimbing"]);
          return a["Nama Praktikan"].localeCompare(b["Nama Praktikan"]);
      });

      const worksheet = XLSX.utils.json_to_sheet(cleanData);
      worksheet['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 30 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Kelas ${selectedGroup.class_code}`);
      
      XLSX.writeFile(workbook, `Plotting_Kelas_${selectedGroup.class_code}_${selectedGroup.major}.xlsx`);
      toast.success(`Excel Kelas ${selectedGroup.class_code} diunduh.`);
  };


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
                    <Users className="w-6 h-6"/> Plotting Asisten & Praktikan
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Kelola pembagian mahasiswa berdasarkan jadwal yang aktif.
                </p>
            </div>
            <div className="flex gap-2 flex-wrap">
                {hasEditAccess && (
                    <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={handleExportSemuaKelompok}>
                        <DownloadCloud className="w-4 h-4 mr-2"/> Export Semua Plotting
                    </Button>
                )}
            </div>
        </div>

        {/* WIDGET FILTER KELAS */}
        {schedules.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex items-center text-muted-foreground font-medium text-sm ml-1 mr-2">
                    <Filter className="w-4 h-4 mr-2" /> Filter:
                </div>
                <Select value={filterDay} onValueChange={setFilterDay}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Semua Hari" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Hari</SelectItem>{uniqueDays.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterMajor} onValueChange={setFilterMajor}>
                    <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Semua Jurusan" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Jurusan</SelectItem>{uniqueMajors.map(major => <SelectItem key={major} value={major}>{major}</SelectItem>)}</SelectContent>
                </Select>
                {(filterDay !== "all" || filterMajor !== "all") && (
                    <Button variant="ghost" size="sm" onClick={() => { setFilterDay("all"); setFilterMajor("all"); }} className="text-red-500 hover:bg-red-50">Reset</Button>
                )}
            </div>
        )}

        {/* LIST KELAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSchedules.length === 0 ? (
                <div className="col-span-3 text-center py-10 text-muted-foreground bg-white rounded border border-dashed">
                    <p>Tidak ada jadwal yang sesuai.</p>
                </div>
            ) : 
            filteredSchedules.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow group relative border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold line-clamp-1" title={item.title}>
                        {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs space-y-1 mt-2">
                        <div className="flex justify-between items-center">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{item.major}</Badge> 
                            <span className="font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">Kelas {item.class_code}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium text-gray-600 pt-1">
                            <Calendar className="w-3 h-3"/> {item.day_of_week}, {item.start_time.slice(0,5)} - {item.end_time.slice(0,5)}
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Dialog open={isDialogOpen && selectedGroup?.id === item.id} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setSelectedGroup(null); }}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="w-full bg-white text-primary border border-primary hover:bg-primary hover:text-white transition-colors" onClick={() => fetchGroupDetails(item)}>
                                <Wand2 className="w-4 h-4 mr-2"/> Kelola Plotting
                            </Button>
                        </DialogTrigger>
                        
                        {/* DIALOG POP-UP KELOLA PLOTTING */}
                        <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="px-6 py-4 border-b bg-gray-50 flex flex-row justify-between items-center">
                                <DialogTitle className="flex flex-col gap-1">
                                    <span>Plotting: {item.title}</span>
                                    <span className="text-xs font-normal text-muted-foreground">{item.major} - Kelas {item.class_code}</span>
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Kelola pembagian asisten dan praktikan untuk kelompok praktikum ini.
                                </DialogDescription>
                                {hasEditAccess && students.length > 0 && (
                                    <Button size="sm" variant="outline" className="h-8 border-green-600 text-green-700 hover:bg-green-50" onClick={handleExportPerKelas}>
                                        <DownloadCloud className="w-4 h-4 mr-2"/> Download Kelompok
                                    </Button>
                                )}
                            </DialogHeader>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
                                {/* KOLOM 1: TIM ASISTEN */}
                                <div className="border-r bg-gray-50/50 p-4 flex flex-col overflow-y-auto">
                                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4"/> Tim Asisten ({assignedAssistants.length})</h3>
                                    <div className="space-y-2 mb-4 flex-1">
                                        {assignedAssistants.length === 0 ? <p className="text-xs text-muted-foreground italic">Belum ada tim.</p> :
                                        assignedAssistants.map(a => (
                                            <div key={a.id} className="bg-white p-2 text-sm rounded border shadow-sm flex justify-between items-center">
                                                <span>{a.users?.full_name}</span>
                                                {hasEditAccess && <Trash2 className="w-3 h-3 text-red-400 cursor-pointer" onClick={async()=>{
                                                    const { error } = await supabase.rpc('delete_group_assistant_secure', {
                                                        p_caller_id: user?.id,
                                                        p_id: a.id
                                                    });
                                                    if(error) toast.error(error.message);
                                                    else fetchGroupDetails(item);
                                                }}/>}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {hasEditAccess && (
                                        <div className="mt-auto pt-4 border-t space-y-2">
                                            <Label className="text-xs">Tambah Asisten (Hanya yg Free)</Label>
                                            <Select value={selectedAssistantId} onValueChange={setSelectedAssistantId}>
                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pilih Asisten"/></SelectTrigger>
                                                <SelectContent>
                                                    {availableAssistants.length === 0 ? <div className="p-2 text-xs text-center text-red-500">Tidak ada yg free :(</div> :
                                                    availableAssistants.map(av => <SelectItem key={av.user_id} value={av.user_id}>{av.users?.full_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Button size="sm" className="w-full" onClick={handleAddAssistant} disabled={!selectedAssistantId}>Tambah Tim</Button>
                                        </div>
                                    )}
                                </div>

                                {/* KOLOM 2: DATA MAHASISWA */}
                                <div className="md:col-span-2 p-4 flex flex-col overflow-hidden bg-white">
                                    <div className="flex justify-between items-center mb-4 pb-4 border-b">
                                        <div>
                                            <h3 className="font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4"/> Mahasiswa ({students.length})</h3>
                                            <p className="text-xs text-muted-foreground">Plotting manual atau otomatis</p>
                                        </div>
                                        
                                        {hasEditAccess && (
                                            <div className="flex gap-2 items-center flex-wrap">
                                                <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleResetPlotting} disabled={loading || students.length === 0}>
                                                    <RotateCcw className="w-3 h-3 mr-1"/> Reset
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSyncStudents} disabled={loading}>
                                                    <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin':''}`}/> Sync User
                                                </Button>
                                                <div className="flex bg-gray-100 rounded border">
                                                    <Select value={distributionMode} onValueChange={setDistributionMode}>
                                                        <SelectTrigger className="h-8 text-xs border-none shadow-none focus:ring-0 bg-transparent w-[140px]">
                                                            <SelectValue placeholder="Metode" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="selang-seling">Selang-seling</SelectItem>
                                                            <SelectItem value="berurutan">Satu Kelompok Urt</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 rounded-l-none" onClick={handleDistributeStudents} disabled={loading || students.length === 0}>
                                                        <Wand2 className="w-3 h-3 mr-1"/> Auto Bagi
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto border rounded-md overflow-x-auto scrollbar-thin">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 sticky top-0 z-10">
                                                <tr><th className="p-3 font-semibold text-xs uppercase text-gray-500">Nama Mahasiswa</th><th className="p-3 font-semibold text-xs uppercase text-gray-500">Pembimbing (Edit)</th></tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {students.length === 0 ? <tr><td colSpan={2} className="p-8 text-center text-gray-400">Data masih kosong.<br/>Klik tombol 'Sync User'.</td></tr> :
                                                students.map(s => (
                                                    <tr key={s.id} className="hover:bg-gray-50">
                                                        <td className="p-3">
                                                            <div className="font-medium">{s.users?.full_name || "Nama tidak ditemukan"}</div>
                                                            <div className="text-xs text-gray-400">{s.users?.nim || "-"}</div>
                                                        </td>
                                                        <td className="p-3 w-[250px]">
                                                            {hasEditAccess ? (
                                                                <Select 
                                                                    value={s.assistant_id ? s.assistant_id : "unassigned"} 
                                                                    onValueChange={(val) => handleUpdateStudentAssistant(s.id, val)}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs w-full bg-white border-gray-200">
                                                                        <SelectValue placeholder="Pilih..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="unassigned" className="text-red-500 font-medium">-- Lepas Pembimbing --</SelectItem>
                                                                        {assignedAssistants.map(a => (
                                                                            <SelectItem key={a.assistant_id} value={a.assistant_id}>{a.users?.full_name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                // View-only untuk yg tidak punya akses
                                                                <Badge variant={s.assistant_id ? "secondary" : "outline"} className={!s.assistant_id ? "text-red-400" : ""}>
                                                                    {s.assistant?.full_name || "Belum diplot"}
                                                                </Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
            ))}
        </div>
      </div>
    </DashboardLayout>
  );
}