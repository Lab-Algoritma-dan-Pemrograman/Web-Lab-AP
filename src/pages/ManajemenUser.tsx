import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { confirm } from "@/lib/confirm";
import * as XLSX from "xlsx";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, UserCog, Loader2, Filter,
  GraduationCap, Briefcase, FileSpreadsheet, Eye, EyeOff, ShieldCheck, Lock, Save, Phone, UserCheck, Download
} from "lucide-react";

// --- KONSTANTA MENU ---
const MASTER_MENUS = [
  { key: "/jadwal-jaga", label: "Jadwal Jaga" },
  { key: "/validasi-absensi", label: "Validasi Absensi" },
  { key: "/manajemen-jadwal", label: "Manajemen Jadwal" },
  { key: "/manajemen-kelas", label: "Manajemen Kelas" },
  { key: "/inventaris", label: "Inventaris Barang" },
  { key: "/manajemen-user", label: "Manajemen User" },
  { key: "/laporan-keuangan", label: "Laporan Keuangan" },
  { key: "/penunjang-praktikum", label: "Penunjang Praktikum" },
  { key: "/ketersediaan", label: "Input Jadwal Free" },
  { key: "/e-learning", label: "Modul E-Learning" },
  { key: "/absensi", label: "Kelola Absensi (Export & Hapus)" },
];

interface UserData {
  id: number;
  username: string;
  password?: string;
  full_name: string;
  phone_number?: string; // TAMBAHAN: Kolom No HP
  role: "koordinator" | "asisten" | "praktikan" | "penyewa";
  nim?: string;
  assistant_code?: string;
  division?: string;
  class_code?: string;
  shift?: string; // TAMBAHAN: Shift 1 atau 2
  is_active: boolean;
}

const DEFAULT_FORM: UserData = {
  id: 0,
  username: "",
  password: "",
  full_name: "",
  phone_number: "", // Default kosong
  role: "praktikan",
  is_active: true,
  nim: "",
  class_code: "",
  shift: "", // Default kosong
  assistant_code: "",
  division: ""
};

const getJurusanByNIM = (nim: string | undefined) => {
  if (!nim || nim.length < 6) return "-";
  const kodeJurusan = nim.substring(4, 6);
  switch (kodeJurusan) {
    case "14": return "S1 Teknik Tenaga Listrik";
    case "15": return "S1 Teknik Sistem Energi";
    case "71": return "D3 Teknologi Listrik";
    case "11": return "S1 Teknik Elektro";
    default: return "Jurusan Lain";
  }
};

export default function ManajemenUser() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // State Filter & UI
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showPassword, setShowPassword] = useState(false);

  // State Dialog & Form
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<UserData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // --- STATE BARU: GLOBAL SHIFT ---
  const [globalActiveShift, setGlobalActiveShift] = useState<string>("all");
  const [isUpdatingShift, setIsUpdatingShift] = useState(false);
  const [shiftFilter, setShiftFilter] = useState<string>("all");

  // --- STATE BARU: HAK AKSES DIVISI ---
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [accessList, setAccessList] = useState<string[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Users & Ambil Divisi Unik
  const fetchUsers = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_users_secure', { p_viewer_id: currentUser.id });

      if (error) throw error;
      setUsers(data as UserData[]);

      // Ekstrak Divisi unik dari data user asisten
      const uniqueDivisions = Array.from(new Set(
        (data as UserData[])
          .filter(u => u.role === 'asisten' && u.division)
          .map(u => u.division as string)
      )).sort();
      setDivisions(uniqueDivisions);

    } catch (error) {
      console.error(error);
      toast.error("Gagal mengambil data user.");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC BULK DELETE ---
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!(await confirm(`Hapus ${selectedIds.length} user terpilih? Seluruh riwayat absensi, bimbingan, dan jadwal yang berkaitan akan ikut terhapus secara permanen.`))) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    // Kita lakukan secara serial agar tidak membani database dan memastikan pembersihan benar
    for (const id of selectedIds) {
      try {
        const { error } = await supabase.rpc('admin_delete_user', {
          p_caller_id: currentUser?.id,
          p_target_id: id
        });
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error(`Gagal menghapus ID ${id}:`, err);
        failCount++;
      }
    }

    toast.success(`Proses selesai. ${successCount} berhasil dihapus, ${failCount} gagal.`);
    setSelectedIds([]);
    fetchUsers();
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchGlobalActiveShift();
  }, []);

  const fetchGlobalActiveShift = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase.rpc('get_system_settings_secure', { p_viewer_id: currentUser.id });
      if (data && data.length > 0) setGlobalActiveShift(data[0].active_shift);
    } catch (err) {
      console.error("Error fetching global shift:", err);
    }
  };

  const handleUpdateActiveShift = async (val: string) => {
    if (!currentUser) return;
    setIsUpdatingShift(true);
    try {
      const { error } = await supabase
        .rpc('admin_update_system_setting', {
          p_caller_id: currentUser.id,
          p_active_shift: val
        });

      if (error) throw error;
      setGlobalActiveShift(val);
      toast.success(`Akses praktikan diatur ke: ${val === 'all' ? 'Semua Aktif' : val === 'none' ? 'Semua Tertutup' : 'Hanya Shift ' + val}`);
    } catch (err: any) {
      toast.error("Gagal update shift global: " + err.message);
    } finally {
      setIsUpdatingShift(false);
    }
  };

  // --- LOGIC HAK AKSES ---
  const fetchDivisionAccess = async (divName: string) => {
    if (!currentUser) return;
    setLoadingAccess(true);
    const { data } = await supabase.rpc('get_division_access_secure', {
      p_viewer_id: currentUser.id,
      p_division: divName
    });
    setAccessList(data ? data.map((d: any) => d.menu_key) : []);
    setLoadingAccess(false);
  };

  useEffect(() => {
    if (selectedDivision && isAccessOpen) fetchDivisionAccess(selectedDivision);
  }, [selectedDivision, isAccessOpen]);

  const handleSaveAccess = async () => {
    if (!currentUser) return;
    if (currentUser.role !== 'koordinator') {
      toast.error("Akses Ditolak", { description: "Hanya Koordinator yang bisa mengelola hak akses divisi." });
      return;
    }
    setLoadingAccess(true);
    try {
      // Simpan akses via RPC aman (SECURITY DEFINER, bypass RLS)
      const { error: accessError } = await supabase.rpc('admin_save_division_access', {
        p_caller_id: currentUser.id,
        p_division: selectedDivision,
        p_menu_keys: accessList.length > 0 ? accessList : []
      });
      if (accessError) throw accessError;
      toast.success("Hak akses disimpan!");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoadingAccess(false); }
  };

  const toggleMenuAccess = (menuKey: string) => {
    setAccessList(prev => prev.includes(menuKey) ? prev.filter(k => k !== menuKey) : [...prev, menuKey]);
  };

  // --- LOGIC CRUD USER ---
  const filteredUsers = users.filter(u => {
    const jurusan = getJurusanByNIM(u.nim);
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.nim && u.nim.includes(search)) ||
      (u.phone_number && u.phone_number.includes(search)) || // Bisa cari pakai nomor HP
      (u.class_code && u.class_code?.toLowerCase().includes(search.toLowerCase())) ||
      (u.division && u.division?.toLowerCase().includes(search.toLowerCase())) ||
      jurusan.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesShift = shiftFilter === "all" || u.shift === shiftFilter;
    return matchesSearch && matchesRole && matchesShift;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // SECURE CHECK: Hanya Koordinator & Asisten yang boleh simpan data
    if (!['koordinator', 'asisten'].includes(currentUser?.role || '')) {
      toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk menyimpan data user." });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        username: formData.username,
        password: formData.password,
        full_name: formData.full_name,
        phone_number: formData.phone_number, // Simpan No HP
        role: formData.role,
        is_active: formData.is_active,
        shift: formData.role === 'praktikan' ? formData.shift : null, // Simpan Shift
        nim: formData.role === 'praktikan' ? formData.username : null,
        class_code: formData.role === 'praktikan' ? formData.class_code : null,
        division: (formData.role === 'asisten' || formData.role === 'koordinator') ? formData.division : null,
        assistant_code: formData.role === 'asisten' ? formData.assistant_code : null,
      };

      if (isEdit) {
        // Update user via RPC aman (SECURITY DEFINER, bypass RLS)
        const { password } = payload;
        const { error: updateError } = await supabase.rpc('admin_update_user', {
          p_caller_id: currentUser?.id,
          p_target_id: formData.id,
          p_username: payload.username,
          p_full_name: payload.full_name,
          p_phone_number: payload.phone_number || null,
          p_role: payload.role,
          p_is_active: payload.is_active,
          p_shift: payload.shift || null,
          p_nim: payload.nim || null,
          p_class_code: payload.class_code || null,
          p_division: payload.division || null,
          p_assistant_code: payload.assistant_code || null
        });
        if (updateError) throw updateError;

        // Jika isian password tidak kosong, maka update password
        if (password && password.length > 0) {
          const { error: pwdError } = await supabase.rpc('update_password', {
            p_caller_id: currentUser?.id, // di-inject proxy dari JWT
            p_target_id: formData.id,     // target user yang diubah
            p_new_password: password
          });
          if (pwdError) throw pwdError;
        }
      } else {
        // Tambah user baru pakai RPC admin (validasi is_admin di database)
        const { error: insertError } = await supabase.rpc('admin_create_user', {
          p_caller_id: currentUser?.id, // di-override proxy dari JWT
          p_username: payload.username,
          p_password: payload.password || "123456", // default
          p_full_name: payload.full_name,
          p_role: payload.role,
          p_nim: payload.nim,
          p_assistant_code: payload.assistant_code,
          p_division: payload.division,
          p_phone_number: payload.phone_number,
          p_class_code: payload.class_code,
          p_shift: payload.shift,
          p_is_active: payload.is_active
        });
        if (insertError) throw insertError;
      }
      toast.success("Data berhasil disimpan!");
      setIsOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    // SECURE CHECK: Hanya Koordinator yang boleh hapus user
    if (currentUser?.role !== 'koordinator') {
      toast.error("Akses Ditolak", { description: "Hanya Koordinator yang dapat menghapus user." });
      return;
    }

    if (!(await confirm(`Hapus user "${name}"? Seluruh riwayat absensi, bimbingan, dan jadwal yang berkaitan dengan orang ini akan ikut terhapus secara permanen.`))) return;

    setLoading(true);
    try {
      // Hapus user beserta seluruh data terkait via RPC aman (SECURITY DEFINER)
      const { error } = await supabase.rpc('admin_delete_user', {
        p_caller_id: currentUser?.id,
        p_target_id: id
      });

      if (error) throw error;

      toast.success("User dan seluruh data terkait berhasil dihapus.");
      fetchUsers();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error("Gagal menghapus user", {
        description: err.message || "Terjadi kesalahan saat mencoba menghapus data terkait."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    // SECURE CHECK: Hanya Koordinator & Asisten yang boleh ubah status
    if (!['koordinator', 'asisten'].includes(currentUser?.role || '')) {
      toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk mengubah status user." });
      return;
    }

    try {
      const { error } = await supabase
        .rpc('admin_toggle_user_status', {
          p_caller_id: currentUser?.id,
          p_target_id: id,
          p_is_active: !currentStatus
        });

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u));
      toast.success(`Status user berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err: any) {
      toast.error("Gagal mengubah status: " + err.message);
    }
  };

  // Import Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // SECURE CHECK: Hanya Koordinator & Asisten yang boleh import
    if (!['koordinator', 'asisten'].includes(currentUser?.role || '')) {
      toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk mengimport data." });
      return;
    }

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (rawData.length === 0) return toast.error("File kosong!");

        const cleanData = rawData.map((row: any) => {
          const clean: any = {};
          Object.keys(row).forEach(k => clean[k.trim().toLowerCase()] = row[k]);
          return clean;
        });

        const formatted = cleanData.map((row: any) => {
          const u = row['username'] || row['nim'];
          if (!u) return null;
          return {
            username: String(u),
            password: String(u),
            full_name: row['nama'] || row['nama lengkap'],
            phone_number: row['no hp'] || row['telepon'] || row['whatsapp'] ? String(row['no hp'] || row['telepon'] || row['whatsapp']) : null,
            role: 'praktikan',
            nim: String(u),
            class_code: row['kelas'],
            shift: row['shift'] ? String(row['shift']) : null,
            is_active: true,
            assistant_code: null,
            division: null
          };
        }).filter(Boolean);

        // Hapus duplikat
        const unique = Array.from(new Map(formatted.map((item: any) => [item.username, item])).values());

        setLoading(true);
        // Menggunakan RPC admin_create_user melalui register_users_batch (validasi is_admin di database)
        const { error } = await supabase.rpc('register_users_batch', { 
          p_caller_id: currentUser?.id, // di-override proxy dari JWT
          p_users: unique 
        });

        if (error) throw error;
        toast.success(`Import berhasil: ${unique.length} data.`);
        fetchUsers();
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
  };

  // Download Template User
  const handleDownloadTemplateUser = () => {
    const templateData = [
      {
        "NIM": "202414001",
        "Nama": "Ahmad Praktikan",
        "No HP": "081234567890",
        "Kelas": "S1-A",
        "Shift": "1"
      },
      {
        "NIM": "202414002",
        "Nama": "Budi Praktikan",
        "No HP": "081298765432",
        "Kelas": "S1-B",
        "Shift": "2"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Praktikan");
    XLSX.writeFile(wb, "Template_Import_Praktikan.xlsx");
    toast.success("Template berhasil diunduh.");
  };

  // Dialog Helpers
  const openAdd = () => { setFormData(DEFAULT_FORM); setIsEdit(false); setShowPassword(false); setIsOpen(true); };
  const openEdit = (user: UserData) => { setFormData({ ...user, password: "" }); setIsEdit(true); setShowPassword(false); setIsOpen(true); };
  const canEdit = (target: UserData) => {
    if (!currentUser) return false;
    if (currentUser.role === 'koordinator') return true;
    if (currentUser.role === 'asisten') return target.id === currentUser.id || target.role === 'praktikan';
    return false;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="w-8 h-8 text-primary" /> Manajemen User
            </h1>
            <p className="text-muted-foreground">Kelola akun, shift, dan hak akses divisi.</p>
          </div>

          {/* GLOBAL SHIFT CONTROL - KHUSUS KOORDINATOR */}
          {currentUser?.role === 'koordinator' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <UserCheck className="w-4 h-4" />
                <span>Akses Praktikan:</span>
              </div>
              <div className="flex bg-white rounded-md border p-1 shadow-sm">
                {[
                  { val: '1', label: 'S1' },
                  { val: '2', label: 'S2' },
                  { val: 'all', label: 'SEMUA' },
                  { val: 'none', label: 'TUTUP' }
                ].map((opt) => (
                  <button
                    key={opt.val}
                    disabled={isUpdatingShift}
                    onClick={() => handleUpdateActiveShift(opt.val)}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all ${globalActiveShift === opt.val
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {isUpdatingShift && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
          )}

          <div className="flex gap-2">
            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

            {(currentUser?.role === 'koordinator' || currentUser?.role === 'asisten') && (
              <>
                {currentUser?.role === 'koordinator' && (
                  <Button variant="secondary" onClick={() => { setSelectedDivision(""); setIsAccessOpen(true); }}>
                    <ShieldCheck className="w-4 h-4 mr-2" /> Kelola Akses Divisi
                  </Button>
                )}

                <div className="flex gap-1">
                  <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Import Excel
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground" title="Download Template Excel" onClick={handleDownloadTemplateUser}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                {selectedIds.length > 0 && (
                  <Button variant="destructive" onClick={handleBulkDelete}>
                    <Trash2 className="w-4 h-4 mr-2" /> Hapus {selectedIds.length} User
                  </Button>
                )}
                <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Tambah Manual</Button>
              </>
            )}
          </div>
        </div>

        {/* TABEL USER */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari Nama, NIM, No HP, Kelas..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="w-full sm:w-[200px]">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger><Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Pilih Peran" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Peran</SelectItem>
                    <SelectItem value="praktikan">Praktikan</SelectItem>
                    <SelectItem value="penyewa">Penyewa Umum</SelectItem>
                    <SelectItem value="asisten">Asisten</SelectItem>
                    <SelectItem value="koordinator">Koordinator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[150px]">
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger><Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Shift" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Shift</SelectItem>
                    <SelectItem value="1">Shift 1</SelectItem>
                    <SelectItem value="2">Shift 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div> : (
              <div className="rounded-md border overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300"
                          checked={filteredUsers.length > 0 && selectedIds.length === filteredUsers.length}
                          onChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap pr-6">Nama Lengkap</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap pr-6">NIM / Username</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap pr-6">Kontak</TableHead>
                      <TableHead className="w-[100px]">Shift</TableHead>
                      <TableHead className="min-w-[150px]">Detail (Kelas)</TableHead>
                      <TableHead className="w-[100px]">Role</TableHead>
                      <TableHead className="text-center w-[120px]">Status</TableHead>
                      <TableHead className="text-center w-[120px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Data tidak ditemukan.</TableCell></TableRow> :
                      filteredUsers.map((u) => (
                        <TableRow key={u.id} className={selectedIds.includes(u.id) ? "bg-muted/50" : ""}>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300"
                              checked={selectedIds.includes(u.id)}
                              onChange={() => toggleSelect(u.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{u.full_name}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{u.username}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {u.phone_number ? (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Phone className="w-3 h-3" /> {u.phone_number}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.role === 'praktikan' ? (
                              <Badge variant="outline" className={`font-bold ${u.shift === '1' ? 'border-orange-200 text-orange-700 bg-orange-50' : 'border-purple-200 text-purple-700 bg-purple-50'}`}>
                                Shift {u.shift || "-"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {u.role === 'praktikan' ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-xs border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-md w-fit">Kelas: {u.class_code || "-"}</span>
                                <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1"><GraduationCap className="w-3 h-3" /><span>{getJurusanByNIM(u.nim)}</span></div>
                              </div>
                            ) : u.role === 'penyewa' ? (
                               <div className="flex flex-col gap-1">
                                 <Badge variant="outline" className="w-fit text-[10px] bg-slate-50 text-slate-500 border-slate-200">PENYEWA UMUM</Badge>
                                 <span className="text-[10px] text-muted-foreground italic ml-1">Katalog Publik Aktif</span>
                               </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-foreground"><Briefcase className="w-3 h-3 text-muted-foreground" /><span>Divisi: {u.division || "-"}</span></div>
                                {u.role === 'asisten' && <span className="text-xs text-muted-foreground pl-5">Kode: {u.assistant_code || "-"}</span>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell><Badge variant={u.role === 'koordinator' ? 'destructive' : u.role === 'asisten' ? 'default' : u.role === 'penyewa' ? 'outline' : 'secondary'}>{u.role.toUpperCase()}</Badge></TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-2">
                              <Switch
                                checked={u.is_active}
                                onCheckedChange={() => handleToggleStatus(u.id, u.is_active)}
                                disabled={!canEdit(u) || (u.id === currentUser?.id && u.role === 'koordinator')}
                              />
                              <span className={`text-[10px] font-bold uppercase w-12 ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                                {u.is_active ? 'Aktif' : 'Non-Aktif'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              {canEdit(u) && <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="w-4 h-4 text-blue-500" /></Button>}
                              {currentUser?.role === 'koordinator' && u.id !== currentUser.id && <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id, u.full_name)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DIALOG 1: FORM USER (Edit/Tambah) */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit Data User" : "Tambah User Baru"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Perbarui informasi akun pengguna di bawah ini." : "Silakan lengkapi formulir untuk mendaftarkan akun baru ke sistem."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Username / NIM</Label><Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="202314..." required disabled={isEdit && currentUser?.role !== 'koordinator'} /></div>
                <div className="space-y-2"><Label>Role</Label><Select value={formData.role} onValueChange={(val: any) => setFormData({ ...formData, role: val })} disabled={currentUser?.role === 'asisten'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="praktikan">Praktikan</SelectItem><SelectItem value="penyewa">Penyewa Umum</SelectItem>{(currentUser?.role === 'koordinator' || formData.role === 'asisten') && <SelectItem value="asisten">Asisten</SelectItem>}{currentUser?.role === 'koordinator' && <SelectItem value="koordinator">Koordinator</SelectItem>}</SelectContent></Select></div>
              </div>

              {/* Row: Nama & No HP */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>No. WhatsApp / HP</Label>
                  <Input value={formData.phone_number || ""} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} placeholder="Contoh: 08123456..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Password {isEdit && <span className="text-[10px] text-muted-foreground font-normal italic">(Kosongkan jika tidak ingin ganti)</span>}</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={formData.password} 
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                    placeholder={isEdit ? "Masukkan password baru" : "Masukkan password"} 
                    required={!isEdit} 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {formData.role === 'praktikan' && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-md">
                  <div className="space-y-2">
                    <Label>Kelas</Label>
                    <Input value={formData.class_code || ""} onChange={(e) => setFormData({ ...formData, class_code: e.target.value })} placeholder="Contoh: IF-A-2024" />
                  </div>
                  <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select value={formData.shift || ""} onValueChange={(val) => setFormData({ ...formData, shift: val })}>
                      <SelectTrigger><SelectValue placeholder="Pilih Shift" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Shift 1</SelectItem>
                        <SelectItem value="2">Shift 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {(formData.role === 'asisten' || formData.role === 'koordinator') && (
                <div className={`grid ${formData.role === 'asisten' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 p-3 bg-muted/50 rounded-md`}>
                  <div className="space-y-2">
                    <Label>Divisi</Label>
                    <Input value={formData.division || ""} onChange={(e) => setFormData({ ...formData, division: e.target.value })} placeholder="Divisi" />
                  </div>
                  {formData.role === 'asisten' && (
                    <div className="space-y-2">
                      <Label>Kode Asisten</Label>
                      <Input value={formData.assistant_code || ""} onChange={(e) => setFormData({ ...formData, assistant_code: e.target.value.toUpperCase() })} placeholder="Contoh: SA" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded-md bg-primary/5">
                <div className="space-y-0.5">
                  <Label>Status Akun</Label>
                  <p className="text-xs text-muted-foreground">Aktifkan atau nonaktifkan akses login user ini.</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                />
              </div>

              <DialogFooter className="pt-4"><Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Batal</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Simpan</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOG 2: HAK AKSES DIVISI */}
        <Dialog open={isAccessOpen} onOpenChange={setIsAccessOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Kelola Hak Akses Divisi</DialogTitle>
              <DialogDescription>Tentukan menu apa saja yang dapat diakses oleh divisi tertentu.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Pilih Divisi</Label>
                <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                  <SelectTrigger><SelectValue placeholder="-- Pilih Divisi --" /></SelectTrigger>
                  <SelectContent>
                    {divisions.length === 0 ? <SelectItem value="empty" disabled>Belum ada divisi terdaftar</SelectItem> :
                      divisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md p-4 min-h-[200px]">
                {!selectedDivision ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <Lock className="w-8 h-8 opacity-20" />
                    <span className="text-sm">Pilih divisi di atas terlebih dahulu.</span>
                  </div>
                ) : loadingAccess ? (
                  <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary" /></div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {MASTER_MENUS.map((menu) => (
                      <div key={menu.key} className="flex items-center space-x-2 border p-2 rounded hover:bg-muted cursor-pointer" onClick={() => toggleMenuAccess(menu.key)}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          checked={accessList.includes(menu.key)}
                          onChange={() => { }}
                        />
                        <label className="text-sm font-medium cursor-pointer flex-1">{menu.label}</label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleSaveAccess} disabled={!selectedDivision || loadingAccess}>
                {loadingAccess ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Simpan Perubahan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}