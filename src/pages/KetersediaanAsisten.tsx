import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, Plus, Trash2, CalendarCheck, Save, UploadCloud, Image as ImageIcon, Loader2, Sparkles, X, FileText, Pencil, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export default function KetersediaanAsisten() {
  const { user, allowedPaths } = useAuth() as any; // Cast as any if allowedPaths is not strictly typed yet
  const [loading, setLoading] = useState(false);
  const [mySlots, setMySlots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("manual");

  // --- OPSI KOORDINATOR & AKSES ---
  const isCoordinator = user?.role === 'koordinator';
  const hasEditAccess = isCoordinator || (allowedPaths && allowedPaths.includes('/ketersediaan'));
  const [assistantsList, setAssistantsList] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // --- Form State Manual & Edit ---
  const [day, setDay] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);

  // --- State Upload File (Gambar/PDF) & AI ---
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedSlots, setDetectedSlots] = useState<any[]>([]);
  // Kami asumsikan penamaan model sesuai instruksi user
  const [selectedAiModel, setSelectedAiModel] = useState("gemini-3-flash");
  const [selectedSlots, setSelectedSlots] = useState<any[]>([]);

  // ==========================================
  // INITIAL LOAD
  // ==========================================
  useEffect(() => {
      // Set default target user ke diri sendiri saat pertama load
      if (user && !targetUserId) {
          setTargetUserId(user.id.toString());
      }
  }, [user]);

  useEffect(() => {
      if (isCoordinator) fetchAssistantsList();
  }, [isCoordinator]);

  useEffect(() => {
      // Fetch slot ulang setiap kali target user berubah
      if (targetUserId) {
          fetchMySlots();
          setSelectedSlots([]); // Clear seleksi saat ganti user
      }
  }, [targetUserId]);

  const fetchAssistantsList = async () => {
      const { data } = await supabase.from('users').select('id, full_name').in('role', ['asisten', 'koordinator']);
      setAssistantsList(data || []);
  };

  // ==========================================
  // FUNGSI BANTUAN ANTI-CRASH
  // ==========================================
  const formatTime = (timeVal: any) => {
      if (!timeVal) return "--:--";
      try { return String(timeVal).substring(0, 5); } catch (e) { return "--:--"; }
  };

  const getSafeString = (val: any, fallback = "-") => {
      try { return val ? String(val) : fallback; } catch (e) { return fallback; }
  };

  // 1. AMBIL DATA JADWAL
  const fetchMySlots = async () => {
    try {
        if(!targetUserId) return;
        const { data, error } = await supabase
          .from('assistant_availability')
          .select('*')
          .eq('user_id', parseInt(targetUserId));
        
        if (error) {
            console.error("Error Fetch DB:", error);
            return;
        }
        
        const validData = Array.isArray(data) ? [...data] : [];
        const dayOrder: Record<string, number> = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6 };
        
        const sortedData = validData.sort((a, b) => {
            const dayA = dayOrder[getSafeString(a?.day_of_week)] || 7;
            const dayB = dayOrder[getSafeString(b?.day_of_week)] || 7;
            return dayA - dayB;
        });
        
        setMySlots(sortedData);
    } catch (error) {
        console.error("Crash saat fetch data:", error);
    }
  };

  // 2. SIMPAN JADWAL (TAMBAH / EDIT)
  const handleSaveSlot = async () => {
    if (!day || !start || !end) return toast.error("Lengkapi data!");
    if (!targetUserId) return toast.error("Pilih Asisten terlebih dahulu!");
    
    setLoading(true);

    try {
        const { error } = await supabase.rpc('save_assistant_availability_secure', {
            p_caller_id: user.id,
            p_target_user_id: parseInt(targetUserId),
            p_id: isEditMode && editingId ? editingId : 0,
            p_day: day,
            p_start: start,
            p_end: end
        });

        setLoading(false);
        if (error) toast.error(error.message);
        else {
            toast.success(isEditMode ? "Jadwal berhasil diperbarui!" : "Jadwal manual ditambahkan!");
            if (isEditMode) handleCancelEdit();
            else { setDay(""); setStart(""); setEnd(""); }
            await fetchMySlots();
        }
    } catch (err: any) {
        setLoading(false);
        toast.error(err.message);
    }
  };

  const handleEditClick = (slot: any) => {
      setDay(getSafeString(slot?.day_of_week, "Senin"));
      setStart(formatTime(slot?.start_time));
      setEnd(formatTime(slot?.end_time));
      setIsEditMode(true);
      setEditingId(slot?.id);
      setActiveTab("manual");
  };

  const handleCancelEdit = () => {
      setDay(""); setStart(""); setEnd("");
      setIsEditMode(false);
      setEditingId(null);
  };

  const handleDelete = async (id: any) => {
    if(!confirm("Hapus slot waktu ini?")) return;
    const { error } = await supabase.rpc('delete_assistant_availability_secure', {
        p_caller_id: user.id,
        p_id: id
    });
    if(!error) {
        toast.success("Berhasil menghapus jadwal");
        await fetchMySlots();
        setSelectedSlots(prev => prev.filter(sid => sid !== id));
    }
    else toast.error("Gagal menghapus data: " + error.message);
  };

  const handleMultipleDelete = async () => {
    if (selectedSlots.length === 0) return;
    if (!confirm(`Hapus ${selectedSlots.length} slot waktu yang dipilih?`)) return;

    setLoading(true);
    let successCount = 0;
    try {
        for (const id of selectedSlots) {
            const { error } = await supabase.rpc('delete_assistant_availability_secure', {
                p_caller_id: user.id,
                p_id: id
            });
            if (!error) successCount++;
        }

        setLoading(false);
        toast.success(`${successCount} jadwal berhasil dihapus!`);
        setSelectedSlots([]);
        await fetchMySlots();
    } catch (err: any) {
        setLoading(false);
        toast.error("Gagal menghapus beberapa data: " + err.message);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSlots.length === mySlots.length) {
        setSelectedSlots([]);
    } else {
        setSelectedSlots(mySlots.map(s => s.id));
    }
  };

  const toggleSelectSlot = (id: any) => {
    setSelectedSlots(prev => 
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  // ==========================================
  // LOGIKA FITUR DETEKSI FILE & AI GEMINI
  // ==========================================
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (file.type.startsWith('image/')) {
          setPreviewUrl(URL.createObjectURL(file));
      } else {
          setPreviewUrl(null); 
      }
      setDetectedSlots([]); 
    }
  };

  const clearFile = () => {
    setUploadFile(null);
    setPreviewUrl(null);
    setDetectedSlots([]);
  };

  async function fileToGenerativePart(file: File) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            resolve({ inlineData: { data: base64Data, mimeType: file.type } });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  }

  const handleAnalyzeFile = async () => {
    if (!uploadFile) return toast.error("Pilih file terlebih dahulu!");

    setAnalyzing(true);
    
    try {
        // Read file as base64
        const fileBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = (reader.result as string).split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(uploadFile);
        });

        // Call server-side API (API key is on server, NOT in browser)
        const secret = import.meta.env.VITE_APP_INTERNAL_SECRET;
        const res = await fetch("/api/analyze-schedule", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-App-Secret": secret || ""
            },
            body: JSON.stringify({ fileBase64, mimeType: uploadFile.type, model: selectedAiModel }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: "Server error" }));
            throw new Error(errData.error || `Server error: ${res.status}`);
        }

        const { slots: detectedData } = await res.json();
        
        if (!Array.isArray(detectedData) || detectedData.length === 0) {
             toast.error("AI tidak menemukan jadwal kosong di dokumen ini.");
             setDetectedSlots([]);
        } else {
             setDetectedSlots(detectedData);
             toast.success(`Berhasil mengekstrak ${detectedData.length} jadwal free!`);
        }
    } catch (err: any) {
        console.error("AI Error:", err);
        toast.error("Gagal menganalisis file. " + (err.message || "Pastikan dokumen terbaca dengan jelas."));
    } finally {
        setAnalyzing(false);
    }
  };

  const handleSaveDetectedSlots = async () => {
    if (!Array.isArray(detectedSlots) || detectedSlots.length === 0) return;
    if (!targetUserId) return toast.error("Pilih Asisten terlebih dahulu!");

    setLoading(true);
    try {
        let successCount = 0;
        for (const slot of detectedSlots) {
            const { error } = await supabase.rpc('save_assistant_availability_secure', {
                p_caller_id: user.id,
                p_target_user_id: parseInt(targetUserId),
                p_id: 0,
                p_day: getSafeString(slot?.day_of_week, "Senin"),
                p_start: formatTime(slot?.start_time),
                p_end: formatTime(slot?.end_time)
            });
            if (!error) successCount++;
        }

        toast.success(`${successCount} jadwal free berhasil disimpan!`);
        clearFile(); 
        await fetchMySlots(); 
    } catch (err: any) {
        toast.error(err.message);
    } finally {
        setLoading(false);
    }
  };

  const renderMySlotsTable = () => {
      try {
          if (!Array.isArray(mySlots) || mySlots.length === 0) {
              return <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Belum ada jadwal yang diinput.</TableCell></TableRow>;
          }
          
          return mySlots.map((slot, index) => {
              if (!slot) return null;
              const isChecked = selectedSlots.includes(slot.id);
              return (
                  <TableRow key={slot?.id || `fallback-${index}`} className={isChecked ? "bg-blue-50/50" : ""}>
                      <TableCell>
                          <Checkbox 
                              checked={isChecked}
                              onCheckedChange={() => toggleSelectSlot(slot.id)}
                          />
                      </TableCell>
                      <TableCell className="font-bold">{getSafeString(slot?.day_of_week, "Tidak diketahui")}</TableCell>
                      <TableCell>
                          <Badge variant="outline" className="flex w-fit items-center gap-1 font-mono text-sm bg-gray-50">
                              <Clock className="w-3 h-3 text-green-600"/> 
                              {formatTime(slot?.start_time)} - {formatTime(slot?.end_time)}
                          </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => handleEditClick(slot)}>
                                  <Pencil className="w-4 h-4"/>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDelete(slot?.id)}>
                                  <Trash2 className="w-4 h-4"/>
                              </Button>
                          </div>
                      </TableCell>
                  </TableRow>
              );
          });
      } catch (error: any) {
          return <TableRow><TableCell colSpan={4} className="text-center py-10 text-red-500 font-bold bg-red-50">Error memuat tabel. Refresh halaman.</TableCell></TableRow>;
      }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* WIDGET HEADER & PILIH ASISTEN (KHUSUS KOORDINATOR) */}
        <div className="bg-white p-5 rounded-lg border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
                    <CalendarCheck className="w-7 h-7"/> Ketersediaan Asisten
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    {isCoordinator 
                        ? "Pilih asisten di samping untuk menginput atau mengedit jadwal mereka." 
                        : "Masukkan jadwal di mana Anda BISA/FREE untuk mengajar praktikum."}
                </p>
            </div>

            {isCoordinator && targetUserId && (
                <div className="bg-blue-50 border border-blue-200 p-2 px-3 rounded-md flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center text-sm font-semibold text-blue-800">
                        <UserCog className="w-4 h-4 mr-2"/> Target Asisten:
                    </div>
                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                        <SelectTrigger className="w-[200px] h-8 bg-white">
                            <SelectValue placeholder="Pilih Asisten" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={user?.id?.toString() || ""}>Diri Sendiri (Anda)</SelectItem>
                            {assistantsList.filter(a => a.id !== user?.id).map(a => (
                                <SelectItem key={a.id} value={a.id.toString()}>{a.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
            
            {/* PANEL INPUT (KIRI - Lebar 2/5) */}
            <div className="lg:col-span-2">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="manual">Input Manual</TabsTrigger>
                        <TabsTrigger value="auto" className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3"/> Auto Deteksi
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB MANUAL */}
                    <TabsContent value="manual">
                        <Card className={isEditMode ? "border-blue-300 shadow-blue-100" : ""}>
                            <CardHeader className="pb-3">
                                <CardTitle className={`text-base flex items-center gap-2 ${isEditMode ? 'text-blue-700' : ''}`}>
                                    {isEditMode ? <><Pencil className="w-4 h-4"/> Edit Slot Jadwal</> : "Tambah Slot Manual"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Hari</Label>
                                    <Select value={day} onValueChange={setDay}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Hari"/></SelectTrigger>
                                        <SelectContent>
                                            {['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Mulai Free</Label>
                                        <Input type="time" value={start} onChange={e => setStart(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Selesai Free</Label>
                                        <Input type="time" value={end} onChange={e => setEnd(e.target.value)} />
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 mt-2">
                                    <Button onClick={handleSaveSlot} disabled={loading} className={`flex-1 ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
                                        {isEditMode ? <><Save className="w-4 h-4 mr-2"/> Simpan</> : <><Plus className="w-4 h-4 mr-2"/> Tambah</>}
                                    </Button>
                                    {isEditMode && (
                                        <Button variant="outline" onClick={handleCancelEdit} disabled={loading}>
                                            Batal
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB AUTO DETEKSI */}
                    <TabsContent value="auto">
                        <Card className="border-blue-100 bg-blue-50/30">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                                    <UploadCloud className="w-4 h-4"/> Upload Jadwal Kuliah
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    AI akan mengekstrak jam kosong dari KRS/Jadwal.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!uploadFile ? (
                                    <div className="border-2 border-dashed border-blue-200 rounded-lg p-6 text-center hover:bg-blue-50 transition-colors relative cursor-pointer bg-white">
                                        <input 
                                            type="file" 
                                            accept="image/png, image/jpeg, application/pdf" 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={handleFileUpload}
                                        />
                                        <div className="flex justify-center gap-2 mb-2 text-blue-400">
                                            <ImageIcon className="w-7 h-7"/>
                                            <FileText className="w-7 h-7"/>
                                        </div>
                                        <p className="text-sm font-medium text-blue-700">Klik / Tarik file ke sini</p>
                                        <p className="text-xs text-muted-foreground mt-1">Format: JPG, PNG, PDF</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="relative rounded-md overflow-hidden border bg-white">
                                            {previewUrl ? (
                                                <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover opacity-80 hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="w-full h-32 flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                                                    <FileText className="w-10 h-10 text-red-500 mb-2" />
                                                    <span className="text-sm font-medium text-gray-700 line-clamp-2">{uploadFile?.name || "Dokumen"}</span>
                                                    <span className="text-xs text-muted-foreground mt-1">{uploadFile ? (uploadFile.size / 1024 / 1024).toFixed(2) : 0} MB</span>
                                                </div>
                                            )}
                                            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6 rounded-full" onClick={clearFile}>
                                                <X className="w-3 h-3"/>
                                            </Button>
                                        </div>

                                        {(!detectedSlots || detectedSlots.length === 0) ? (
                                            <div className="space-y-3">
                                                {hasEditAccess && (
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs w-[120px] text-muted-foreground">Pilih Model AI:</Label>
                                                        <Select value={selectedAiModel} onValueChange={setSelectedAiModel}>
                                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                                <SelectValue placeholder="Pilih Model" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="gemini-3-flash">Gemini 3 Flash (High)</SelectItem>
                                                                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                <Button onClick={handleAnalyzeFile} disabled={analyzing} className="w-full bg-blue-600 hover:bg-blue-700">
                                                    {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Sedang Membaca Dokumen...</> : <><Sparkles className="w-4 h-4 mr-2"/> Cari Jam Kosong</>}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="bg-white p-3 rounded border border-green-200 space-y-3 shadow-sm">
                                                <p className="text-xs font-bold text-green-700">Berhasil Ditemukan ({detectedSlots.length} slot):</p>
                                                <ul className="text-xs space-y-1">
                                                    {detectedSlots.map((slot, i) => (
                                                        <li key={i} className="flex justify-between border-b pb-1">
                                                            <span>{getSafeString(slot?.day_of_week, "?")}</span>
                                                            <span className="font-mono text-green-700 font-medium">
                                                                {formatTime(slot?.start_time)} - {formatTime(slot?.end_time)}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <Button onClick={handleSaveDetectedSlots} disabled={loading} size="sm" className="w-full bg-green-600 hover:bg-green-700">
                                                    <Save className="w-4 h-4 mr-2"/> Simpan Semua
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* TABEL LIST JADWAL SAYA (KANAN - Lebar 3/5) */}
            <div className="lg:col-span-3">
                <Card className="h-full">
                    <CardHeader className="pb-3 border-b mb-2">
                        <CardTitle className="text-lg flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span>Jadwal Free Tersimpan</span>
                                {selectedSlots.length > 0 && (
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        className="h-7 px-2 text-xs flex items-center gap-1 animate-in fade-in slide-in-from-left-2"
                                        onClick={handleMultipleDelete}
                                        disabled={loading}
                                    >
                                        <Trash2 className="w-3 h-3"/> Hapus {selectedSlots.length}
                                    </Button>
                                )}
                            </div>
                            {isCoordinator && targetUserId !== user?.id?.toString() && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs border-none">
                                    Lihat Mode Koordinator
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox 
                                            checked={mySlots.length > 0 && selectedSlots.length === mySlots.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Hari</TableHead>
                                    <TableHead>Jam Free</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {renderMySlotsTable()}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

        </div>
      </div>
    </DashboardLayout>
  );
}