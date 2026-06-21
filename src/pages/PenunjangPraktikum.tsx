import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { confirm } from "@/lib/confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
    Loader2, Search, Plus, Pencil, Trash2, 
    DownloadCloud, FileText, FileSpreadsheet, Box, Link as LinkIcon, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Equipment {
    id: number;
    name: string;
    type: string;
    description: string;
    file_url: string;
    uploaded_at: string;
}

const DEFAULT_FORM = { id: 0, name: "", type: "module_pdf", description: "", file_url: "" };

export default function PenunjangPraktikum() {
    const { user } = useAuth();
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("all");
    
    // Dialog State
    const [isOpen, setIsOpen] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [formData, setFormData] = useState(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);

    // State Hak Akses
    const [hasEditAccess, setHasEditAccess] = useState(false);

    // Cek Akses Edit
    const checkAccess = async () => {
        if (user?.role === 'koordinator') { 
            setHasEditAccess(true); 
            return; 
        }
        if (user?.division) {
            const { data } = await supabase
                .from('division_access')
                .select('*')
                .eq('division', user.division)
                .eq('menu_key', '/penunjang-praktikum');
                
            if (data && data.length > 0) {
                setHasEditAccess(true);
            }
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_equipment_secure');
            
            if (error) throw error;
            setEquipments(data || []);
        } catch (error: any) {
            toast.error("Gagal mengambil data penunjang: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Jalankan cek akses dan ambil data saat user tersedia
    useEffect(() => { 
        if (user) {
            checkAccess();
            fetchData(); 
        }
    }, [user]);

    // Filter Logic
    const filteredData = equipments.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
        const matchType = filterType === "all" || item.type === filterType;
        return matchSearch && matchType;
    });

    // CRUD Handlers
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.name || !formData.file_url) return toast.error("Nama dan Link File wajib diisi!");
        
        setSaving(true);
        try {
            const { error } = await supabase.rpc('upsert_equipment_secure', {
                p_caller_id: user.id,
                p_id: isEdit ? formData.id : 0,
                p_name: formData.name,
                p_type: formData.type,
                p_description: formData.description,
                p_file_url: formData.file_url
            });

            if (error) throw error;
            
            toast.success(isEdit ? "Data berhasil diperbarui!" : "Materi baru berhasil ditambahkan!");
            setIsOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!(await confirm(`Yakin ingin menghapus "${name}"?`))) return;
        try {
            const { error } = await supabase.rpc('delete_equipment_secure', {
                p_caller_id: user.id,
                p_id: id
            });
            if (error) throw error;
            toast.success("Data dihapus.");
            fetchData();
        } catch (err: any) {
            toast.error("Gagal menghapus: " + err.message);
        }
    };

    const openAdd = () => { setFormData(DEFAULT_FORM); setIsEdit(false); setIsOpen(true); };
    const openEdit = (item: Equipment) => { setFormData({ ...item }); setIsEdit(true); setIsOpen(true); };

    // Helper Icon & Badge
    const getTypeDisplay = (type: string) => {
        switch (type) {
            case 'module_pdf': return { label: 'Modul Praktikum', color: 'bg-red-100 text-red-800 border-red-200', icon: <FileText className="w-4 h-4 mr-1 text-red-600"/> };
            case 'report_format': return { label: 'Format Laporan', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <FileSpreadsheet className="w-4 h-4 mr-1 text-blue-600"/> };
            case 'software': return { label: 'Software / Tools', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Box className="w-4 h-4 mr-1 text-purple-600"/> };
            default: return { label: 'Lainnya', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: <LinkIcon className="w-4 h-4 mr-1 text-gray-600"/> };
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <DownloadCloud className="w-8 h-8 text-primary" /> Materi & Penunjang
                        </h1>
                        <p className="text-muted-foreground">Download modul, format laporan, dan software praktikum.</p>
                    </div>
                    {/* HANYA MUNCUL JIKA PUNYA AKSES EDIT */}
                    {hasEditAccess && (
                        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Tambah File / Link</Button>
                    )}
                </div>

                {/* FILTER & SEARCH */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari nama materi atau deskripsi..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            <div className="w-full sm:w-[220px]">
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Jenis File</SelectItem>
                                        <SelectItem value="module_pdf">Modul Praktikum</SelectItem>
                                        <SelectItem value="report_format">Format Laporan</SelectItem>
                                        <SelectItem value="software">Software / Tools</SelectItem>
                                        <SelectItem value="other">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
                        ) : (
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Nama File / Materi</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Diunggah Pada</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada file yang ditemukan.</TableCell></TableRow>
                                        ) : (
                                            filteredData.map((item) => {
                                                const typeInfo = getTypeDisplay(item.type);
                                                return (
                                                    <TableRow key={item.id} className="hover:bg-gray-50/50">
                                                        <TableCell>
                                                            <div className="font-bold text-gray-800">{item.name}</div>
                                                            {item.description && <div className="text-xs text-muted-foreground mt-1 max-w-md">{item.description}</div>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`flex w-fit items-center px-2.5 py-0.5 ${typeInfo.color}`}>
                                                                {typeInfo.icon} {typeInfo.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-gray-500">
                                                            {new Date(item.uploaded_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2 items-center">
                                                                {/* Tombol Unduh/Buka untuk SEMUA user */}
                                                                <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                                                        <ExternalLink className="w-4 h-4 mr-1.5"/> Buka
                                                                    </Button>
                                                                </a>
                                                                
                                                                {/* Tombol Edit/Delete KHUSUS Koordinator / Asisten Berhak */}
                                                                {hasEditAccess && (
                                                                    <>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => openEdit(item)}>
                                                                            <Pencil className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDelete(item.id, item.name)}>
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* MODAL FORM (HANYA BISA DIAKSES JIKA PUNYA HAK EDIT) */}
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{isEdit ? "Edit File / Link" : "Tambah File / Link Penunjang"}</DialogTitle></DialogHeader>
                        <form onSubmit={handleSave} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nama File / Materi <span className="text-red-500">*</span></Label>
                                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Contoh: Modul 1: Algoritma" />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Kategori File <span className="text-red-500">*</span></Label>
                                <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="module_pdf">Modul Praktikum</SelectItem>
                                        <SelectItem value="report_format">Format Laporan</SelectItem>
                                        <SelectItem value="software">Software / Tools</SelectItem>
                                        <SelectItem value="other">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Link Download / URL <span className="text-red-500">*</span></Label>
                                <Input required value={formData.file_url} onChange={e => setFormData({...formData, file_url: e.target.value})} placeholder="Masukkan link Google Drive / Website" />
                                <p className="text-[11px] text-muted-foreground">Pastikan link dapat diakses oleh publik (Anyone with the link).</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Deskripsi Singkat (Opsional)</Label>
                                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Contoh: Baca halaman 1-5 sebelum praktikum" />
                            </div>

                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Batal</Button>
                                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : "Simpan"}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}