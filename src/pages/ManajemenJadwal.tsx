import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth"; 
import DashboardLayout from "@/components/layout/DashboardLayout";
import { confirm } from "@/lib/confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; 
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CalendarDays, Clock, Save, Info, Pencil, Filter, FileSpreadsheet, Download } from "lucide-react";
import * as XLSX from 'xlsx'; // Pastikan sudah install: npm install xlsx

export default function ManajemenJadwal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  
  // Ref untuk input file
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Dialog & Filter
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [filterDay, setFilterDay] = useState("all");

  // Form State
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState(""); 
  const [major, setMajor] = useState(""); 
  const [classCode, setClassCode] = useState(""); 

  // --- 1. FETCH DATA ---
  const fetchSchedules = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_schedules_secure', { p_viewer_id: user.id });
    if (error) console.error("Error fetch:", error);
    else {
        let filtered = data || [];
        if (filterDay !== "all") {
            filtered = filtered.filter((s: any) => s.day_of_week === filterDay);
        }
        setSchedules(filtered);
    }
  };

  useEffect(() => { fetchSchedules(); }, [filterDay]);

  // --- 2. IMPORT EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
    // Data Template
    const templateData = [
      {
        "Mata Kuliah": "Praktikum Algoritma",
        "Jurusan": "Teknik Informatika",
        "Kelas": "A",
        "Hari": "Senin",
        "Jam Mulai": "08:00",
        "Jam Selesai": "10:00"
      },
      {
        "Mata Kuliah": "Praktikum Basis Data",
        "Jurusan": "Sistem Informasi",
        "Kelas": "B",
        "Hari": "Selasa",
        "Jam Mulai": "13:00",
        "Jam Selesai": "15:00"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Jadwal");
    XLSX.writeFile(wb, "Template_Import_Jadwal.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        setImporting(true);
        try {
            // SECURE CHECK: Hanya Koordinator yang boleh import jadwal massal
            if (user?.role !== 'koordinator') {
                toast.error("Akses Ditolak", { description: "Hanya Koordinator yang dapat mengimport jadwal." });
                setImporting(false);
                return;
            }
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length === 0) {
                toast.error("File Excel kosong!");
                setImporting(false);
                return;
            }

            // Mapping Data Excel ke Database
            const formattedData = data.map((row: any) => ({
                title: row['Mata Kuliah'] || row['Title'],
                major: row['Jurusan'] || row['Major'],
                class_code: row['Kelas'] || row['Class'],
                day_of_week: row['Hari'] || row['Day'],
                start_time: row['Jam Mulai'] || row['Start'],
                end_time: row['Jam Selesai'] || row['End'],
                type: 'praktikum',
                status: 'approved' // Langsung approved jika import (asumsi yg import Koordinator)
            }));

            // Validasi data penting tidak boleh kosong
            const validData = formattedData.filter(d => d.title && d.day_of_week && d.start_time);

            if (validData.length === 0) {
                toast.error("Format Excel tidak sesuai. Gunakan template.");
                setImporting(false);
                return;
            }

            // Insert ke Supabase via RPC dalam loop (untuk batching sederhana yang aman)
            let successCount = 0;
            for (const item of validData) {
                const { error } = await supabase.rpc('upsert_schedule_secure', {
                    p_caller_id: user.id,
                    p_id: 0,
                    p_day_of_week: item.day_of_week,
                    p_start_time: item.start_time,
                    p_end_time: item.end_time,
                    p_title: item.title,
                    p_major: item.major,
                    p_class_code: item.class_code,
                    p_type: item.type,
                    p_status: item.status
                });
                if (!error) successCount++;
            }

            toast.success(`Berhasil mengimport ${successCount} jadwal!`);
            fetchSchedules();
        } catch (error: any) {
            console.error(error);
            toast.error("Gagal import: " + error.message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
        }
    };
    reader.readAsBinaryString(file);
  };

  // --- 3. CRUD HANDLERS ---
  const openAddDialog = () => {
      setIsEditMode(false);
      setDay(""); setStartTime(""); setEndTime(""); setTitle(""); setMajor(""); setClassCode(""); 
      setIsDialogOpen(true);
  };

  const openEditDialog = (item: any) => {
      setIsEditMode(true);
      setEditId(item.id);
      setDay(item.day_of_week);
      setStartTime(item.start_time);
      setEndTime(item.end_time);
      setTitle(item.title);
      setMajor(item.major || ""); setClassCode(item.class_code || ""); 
      setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!day || !startTime || !endTime || !title || !major || !classCode) return toast.error("Semua kolom wajib diisi!");
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.rpc('upsert_schedule_secure', {
        p_caller_id: user.id,
        p_id: isEditMode && editId ? editId : 0,
        p_day_of_week: day,
        p_start_time: startTime,
        p_end_time: endTime,
        p_title: title,
        p_major: major,
        p_class_code: classCode,
        p_type: 'praktikum',
        p_status: user?.role === 'koordinator' ? 'approved' : 'pending'
      });

      if (error) throw error;
      toast.success(isEditMode ? "Jadwal diperbarui!" : "Jadwal disimpan!");
      setIsDialogOpen(false); fetchSchedules(); 
    } catch (error: any) { toast.error("Gagal: " + error.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!user) return;
    if (!(await confirm("Hapus jadwal ini?"))) return;
    
    const { error } = await supabase.rpc('delete_schedule_secure', {
        p_caller_id: user.id,
        p_id: id
    });
    if (error) toast.error("Gagal: " + error.message);
    else { toast.success("Jadwal dihapus"); fetchSchedules(); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
                    <CalendarDays className="w-6 h-6"/> Manajemen Jadwal
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Atur slot waktu, jurusan, dan kelas praktikum.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full xl:w-auto">
                {/* FILTER */}
                <div className="flex items-center gap-2 border rounded-md px-3 py-1 bg-gray-50 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-muted-foreground"/>
                    <Select value={filterDay} onValueChange={setFilterDay}>
                        <SelectTrigger className="border-none bg-transparent h-8 w-[130px] focus:ring-0"><SelectValue placeholder="Filter Hari"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Hari</SelectItem>
                            {['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {user?.role !== 'praktikan' && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        {/* TOMBOL IMPORT EXCEL */}
                        <div className="flex gap-1">
                            <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                            
                            <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                                {importing ? <Loader2 className="animate-spin w-4 h-4"/> : <FileSpreadsheet className="w-4 h-4 mr-2"/>}
                                Import
                            </Button>
                            
                            <Button variant="ghost" size="icon" className="text-muted-foreground" title="Download Template Excel" onClick={handleDownloadTemplate}>
                                <Download className="w-4 h-4"/>
                            </Button>
                        </div>

                        {/* TOMBOL TAMBAH MANUAL */}
                        <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4"/> Baru</Button>
                    </div>
                )}
            </div>
        </div>

        {/* TABEL DATA */}
        <Card>
          <CardHeader><CardTitle>Daftar Jadwal Tersedia ({schedules.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>Hari & Jam</TableHead>
                    <TableHead>Mata Kuliah / Sesi</TableHead>
                    <TableHead>Jurusan</TableHead>
                    <TableHead>Kelas</TableHead> 
                    {user?.role === 'koordinator' && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Belum ada jadwal.</TableCell></TableRow>
                ) : (
                  schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                          <div className="font-bold">{s.day_of_week}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="w-3 h-3"/> {s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}
                          </div>
                      </TableCell>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell>
                          {s.major === 'Teknik Tenaga Listrik' && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">TTL</Badge>}
                          {s.major === 'Teknik Elektro' && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">TE</Badge>}
                          {s.major === 'Teknik Sistem Energi' && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">TSE</Badge>}
                          {s.major === 'Teknologi Listrik' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">TL</Badge>}
                          {!['Teknik Tenaga Listrik','Teknik Elektro','Teknik Sistem Energi', 'Teknologi Listrik'].includes(s.major) && <span className="text-sm">{s.major}</span>}
                      </TableCell>
                      <TableCell><div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold text-sm border">{s.class_code}</div></TableCell>
                      {user?.role === 'koordinator' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => openEditDialog(s)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* DIALOG FORM */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>{isEditMode ? "Edit Jadwal" : "Buat Jadwal Baru"}</DialogTitle></DialogHeader>
                {user?.role === 'asisten' && <div className="bg-blue-50 text-blue-700 p-2 text-xs rounded mb-2"><Info className="w-3 h-3 inline mr-1"/>Perlu ACC Koordinator.</div>}
                <div className="grid gap-4 py-2">
                    <div className="space-y-1"><Label>Nama Mata Kuliah / Sesi</Label><Input placeholder="Contoh: Praktikum Algoritma" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Jurusan</Label>
                            <Select value={major} onValueChange={setMajor}>
                                <SelectTrigger><SelectValue placeholder="Pilih Jurusan" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Teknik Tenaga Listrik">Teknik Tenaga Listrik</SelectItem>
                                    <SelectItem value="Teknik Elektro">Teknik Elektro</SelectItem>
                                    <SelectItem value="Teknik Sistem Energi">Teknik Sistem Energi</SelectItem>
                                    <SelectItem value="Teknologi Listrik">Teknologi Listrik</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1"><Label>Kelas / Kode</Label><Input placeholder="Contoh: A, B" value={classCode} onChange={(e) => setClassCode(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1"><Label>Hari</Label>
                        <Select value={day} onValueChange={setDay}>
                            <SelectTrigger><SelectValue placeholder="Pilih Hari" /></SelectTrigger>
                            <SelectContent>{['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Jam Mulai</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Jam Selesai</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading} className="w-full">{loading ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-4 w-4"/>} Simpan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}