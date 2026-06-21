import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { confirm } from "@/lib/confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, FileDown } from "lucide-react";
import * as XLSX from "xlsx"; // <-- Import library Excel

export default function LaporanKeuangan() {
  const { user } = useAuth(); // <-- Ambil data user
  const [records, setRecords] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "pemasukan", amount: 0, category: "Kas" });
  
  // State Khusus untuk Hak Akses EXPORT
  const [hasExportAccess, setHasExportAccess] = useState(false);

  // --- CEK HAK AKSES EXPORT ---
  useEffect(() => {
    const checkExportAccess = async () => {
      if (!user) return;
      
      const { data, error } = await supabase.rpc('check_menu_access_secure', {
          p_viewer_id: user.id,
          p_menu_key: '/laporan-keuangan'
      });
      
      if (!error && data) {
          setHasExportAccess(true);
      }
    };
    checkExportAccess();
  }, [user]);

  const fetchRecords = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_financial_records_secure', { p_viewer_id: user.id });
    setRecords(data || []);
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSave = async () => {
    const { error } = await supabase.rpc('upsert_financial_record_secure', {
        p_caller_id: user.id,
        p_id: 0,
        p_title: form.title,
        p_amount: form.amount,
        p_type: form.type,
        p_category: form.category
    });
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else { toast.success("Data tersimpan"); setIsOpen(false); fetchRecords(); }
  };

  const handleDelete = async (id: number) => {
    if(await confirm("Hapus data ini?")) {
        const { error } = await supabase.rpc('delete_financial_record_secure', {
            p_caller_id: user.id,
            p_id: id
        });
        if (error) toast.error("Gagal menghapus: " + error.message);
        else {
            toast.success("Data dihapus");
            fetchRecords();
        }
    }
  };

  // Hitung Saldo
  const totalMasuk = records.filter(r => r.type === 'pemasukan').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalKeluar = records.filter(r => r.type === 'pengeluaran').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const saldo = totalMasuk - totalKeluar;

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
    if (records.length === 0) {
      return toast.warning("Tidak ada data transaksi untuk diekspor.");
    }

    // 1. Format data baris transaksi
    const dataToExport: any[] = records.map((r, index) => ({
      "No": index + 1,
      "Tanggal": new Date(r.date).toLocaleDateString('id-ID'),
      "Keterangan": r.title,
      "Kategori": r.category,
      "Tipe": r.type.toUpperCase(),
      "Pemasukan (Rp)": r.type === 'pemasukan' ? Number(r.amount) : 0,
      "Pengeluaran (Rp)": r.type === 'pengeluaran' ? Number(r.amount) : 0
    }));

    // 2. Tambahkan spasi pemisah
    dataToExport.push({});

    // 3. Tambahkan baris ringkasan (Summary) di bagian bawah excel
    dataToExport.push({ "Keterangan": "TOTAL PEMASUKAN", "Pemasukan (Rp)": totalMasuk });
    dataToExport.push({ "Keterangan": "TOTAL PENGELUARAN", "Pengeluaran (Rp)": totalKeluar });
    dataToExport.push({ "Keterangan": "SALDO AKHIR TERSISA", "Pemasukan (Rp)": saldo });

    // Generate dan Download Excel
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Kas Lab");
    XLSX.writeFile(wb, `Laporan_Keuangan_Lab_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("File Excel berhasil di-download!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="text-primary"/> Laporan Keuangan</h1>
        
        {/* Ringkasan Saldo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pemasukan</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Rp {totalMasuk.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600 flex items-center gap-2"><TrendingDown className="w-5 h-5"/> Rp {totalKeluar.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-primary">Saldo Akhir</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-primary">Rp {saldo.toLocaleString()}</div></CardContent>
            </Card>
        </div>

        {/* Tabel Transaksi */}
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Riwayat Transaksi</CardTitle>
                <div className="flex flex-wrap gap-2">
                    {/* Tombol Export hanya muncul jika user punya hak akses */}
                    {hasExportAccess && (
                        <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={handleExportExcel}>
                            <FileDown className="mr-2 w-4 h-4"/> Export Excel
                        </Button>
                    )}
                    <Button onClick={() => setIsOpen(true)}><Plus className="mr-2 w-4 h-4"/> Catat Transaksi</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead>Kategori</TableHead><TableHead>Tipe</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead/></TableRow></TableHeader>
                        <TableBody>
                            {records.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Belum ada catatan transaksi.</TableCell></TableRow>
                            ) : (
                                records.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell>{r.date ? new Date(r.date).toLocaleDateString('id-ID') : (r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-')}</TableCell>
                                        <TableCell className="font-medium">{r.title || "Tanpa Keterangan"}</TableCell>
                                        <TableCell>{r.category}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${r.type === 'pemasukan' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                                {r.type.toUpperCase()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">Rp {Number(r.amount).toLocaleString()}</TableCell>
                                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-red-400 hover:text-red-600"/></Button></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        {/* Modal Tambah */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Catat Keuangan</DialogTitle>
                    <DialogDescription>
                        Masukkan detail transaksi keuangan kas laboratorium.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <Input placeholder="Keterangan (misal: Beli Spidol)" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="pemasukan">Pemasukan</SelectItem><SelectItem value="pengeluaran">Pengeluaran</SelectItem></SelectContent>
                        </Select>
                        <Input type="number" placeholder="Jumlah (Rp)" onChange={e => setForm({...form, amount: Number(e.target.value)})} />
                    </div>
                    <Input placeholder="Kategori (misal: Kas, Inventaris)" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
                </div>
                <DialogFooter><Button onClick={handleSave}>Simpan</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}