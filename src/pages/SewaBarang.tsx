import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Box, Search, Calendar, MessageSquare, History, Tag, ShoppingBag, Info, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function SewaBarang() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adminContact, setAdminContact] = useState<any>(null);
  
  const [form, setForm] = useState({
    quantity: 1,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    type: "sewa",
    notes: ""
  });

  const fetchData = async () => {
    if (!user) return;
    
    // Fetch Available Items
    const { data: itemsData } = await supabase.rpc('get_renter_items_secure');
    setItems(itemsData || []);

    // Fetch My Rentals
    const { data: rentalsData } = await supabase.rpc('get_my_rentals_secure', { p_user_id: user.id });
    setMyRentals(rentalsData || []);

    // Fetch Admin Contact for WA
    const { data: contactData } = await supabase.rpc('get_smart_validation_contact_secure', { p_student_id: user.id });
    if (contactData && contactData.length > 0) {
      setAdminContact(contactData[0]);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSubmitRequest = async () => {
    if (!user || !selectedItem) return;

    if (form.quantity > selectedItem.quantity) {
      toast.error("Stok tidak mencukupi");
      return;
    }

    const { error } = await supabase.rpc('submit_rental_request_secure', {
      p_user_id: user.id,
      p_item_id: selectedItem.id,
      p_quantity: parseInt(form.quantity.toString()),
      p_start_date: new Date(form.startDate).toISOString(),
      p_end_date: new Date(form.endDate).toISOString(),
      p_type: form.type,
      p_notes: form.notes
    });

    if (error) {
      toast.error("Gagal mengirim permintaan: " + error.message);
    } else {
      toast.success("Permintaan berhasil terkirim!");
      setIsRequestOpen(false);
      fetchData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1"/> Disetujui</Badge>;
      case 'active': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><ShoppingBag className="w-3 h-3 mr-1"/> Dipinjam</Badge>;
      case 'returned': return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Selesai</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1"/> Ditolak</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const openWA = (rental: any = null) => {
    if (!adminContact?.phone_number) {
        toast.error("Kontak admin tidak tersedia saat ini.");
        return;
    }
    const phone = adminContact.phone_number.replace(/\D/g, '').replace(/^0/, '62');
    const text = rental 
        ? `Halo Admin Lab, saya ${user?.full_name} ingin memverifikasi identitas (KTM) untuk pengajuan sewa/pinjam barang: ${rental.item_name} (ID: ${rental.id}).`
        : `Halo Admin Lab, saya ${user?.full_name} ingin bertanya mengenai prosedur sewa barang di Lab Algoritma.`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-transparent p-6 rounded-2xl border border-primary/10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Katalog Sewa & Pinjam</h1>
            <p className="text-slate-500 mt-1">Penyewaan barang untuk publik dan peminjaman alat praktik.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openWA()} className="bg-white hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all">
              <MessageSquare className="w-4 h-4 mr-2 text-green-500" /> Hubungi Admin
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-primary/20 shadow-sm overflow-hidden group">
                <CardHeader className="bg-slate-50 border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Tag className="w-5 h-5 text-primary" /> Katalog Barang
                        </CardTitle>
                        <div className="relative w-48 md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Cari barang..." 
                                className="pl-9 h-9 bg-white" 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto scrollbar-thin">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-bold">Nama Barang</TableHead>
                                    <TableHead className="font-bold">Tersedia</TableHead>
                                    <TableHead className="font-bold">Harga / Hari</TableHead>
                                    <TableHead className="text-right font-bold">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                            Tidak ada barang yang tersedia untuk disewa saat ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredItems.map(item => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell>
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                <div className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                                    <Info className="w-3 h-3" /> {item.location} - {item.condition}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-medium bg-slate-200">
                                                   {item.quantity} Unit
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono font-bold text-primary">
                                                {item.price_per_day > 0 ? `Rp ${item.price_per_day.toLocaleString()}` : "Gratis (Pinjam)"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => { setSelectedItem(item); setIsRequestOpen(true); }} className="rounded-full px-4 hover:scale-105 active:scale-95 transition-all">
                                                    Ajukan
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="border-yellow-200 bg-yellow-50/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
                            <AlertCircle className="w-4 h-4" /> Prosedur Sewa
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-[11px] leading-relaxed text-yellow-900/80 space-y-2 italic">
                        <p>1. Pilih barang dari katalog dan isi detail peminjaman.</p>
                        <p>2. Setelah mengajukan, klik tombol <strong>Hubungi Admin</strong> di riwayat untuk verifikasi identitas (Kirim foto KTM).</p>
                        <p>3. Tunggu persetujuan status hingga berubah menjadi <strong>Disetujui</strong>.</p>
                        <p>4. Barang dapat diambil di lab sesuai jadwal yang diajukan.</p>
                    </CardContent>
                </Card>

                {/* My History Card */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <History className="w-4 h-4 text-primary" /> Pengajuan Saya
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[400px] overflow-y-auto scrollbar-thin">
                        {myRentals.length === 0 ? (
                            <div className="py-10 text-center text-[11px] text-muted-foreground px-4">
                                Belum ada riwayat pengajuan.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {myRentals.map(rental => (
                                    <div key={rental.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-xs">{rental.item_name}</span>
                                            {getStatusBadge(rental.status)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(rental.start_date), "dd MMM", {locale: localeId})} - {format(new Date(rental.end_date), "dd MMM yyyy", {locale: localeId})}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4">
                                                    {rental.type}
                                                </Badge>
                                                <span className="font-bold text-primary">Rp {rental.total_price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {rental.status === 'pending' && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-full text-[10px] h-7 mt-1 border-green-200 text-green-700 bg-green-50"
                                                onClick={() => openWA(rental)}
                                            >
                                                <MessageSquare className="w-3 h-3 mr-1" /> Verifikasi KTM (WA)
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* Request Modal */}
        <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
            <DialogContent className="max-w-md bg-white">
                <DialogHeader>
                    <DialogTitle>Form Pengajuan {selectedItem?.name}</DialogTitle>
                    <DialogDescription>Isi detail peminjaman/sewa barang di bawah ini.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tipe Pengajuan</Label>
                            <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="sewa">Sewa (Berbayar)</SelectItem>
                                    <SelectItem value="pinjam">Pinjam (Praktik/Gratis)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Jumlah Barang</Label>
                            <Input 
                                type="number" 
                                value={form.quantity} 
                                onChange={e => setForm({...form, quantity: parseInt(e.target.value)})} 
                                className="h-9"
                                min={1}
                                max={selectedItem?.quantity}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tanggal Mulai</Label>
                            <Input 
                                type="date" 
                                value={form.startDate} 
                                onChange={e => setForm({...form, startDate: e.target.value})} 
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tanggal Selesai</Label>
                            <Input 
                                type="date" 
                                value={form.endDate} 
                                onChange={e => setForm({...form, endDate: e.target.value})} 
                                className="h-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Catatan / Tujuan (Opsional)</Label>
                        <Input 
                            placeholder="Contoh: Untuk keperluan praktikum mata kuliah X" 
                            className="h-9"
                            value={form.notes}
                            onChange={e => setForm({...form, notes: e.target.value})}
                        />
                    </div>

                    {form.type === 'sewa' && selectedItem?.price_per_day > 0 && (
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-600">Estimasi Biaya:</span>
                            <span className="text-lg font-bold text-primary">
                                Rp {(selectedItem.price_per_day * form.quantity).toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">/ hari</span>
                            </span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsRequestOpen(false)}>Batal</Button>
                    <Button onClick={handleSubmitRequest}>Ajukan Permintaan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
