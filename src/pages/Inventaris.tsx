import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box, Plus, Pencil, Trash2, Search, Share2, DollarSign } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Inventaris() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", condition: "Baik", quantity: 1, location: "", is_rentable: false, price_per_day: 0 });

  const fetchItems = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_inventory_items_secure', { p_viewer_id: user.id });
    setItems(data || []);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.rpc('upsert_inventory_item_secure', {
        p_caller_id: user.id,
        p_id: form.id?.toString() || "0",
        p_name: form.name,
        p_condition: form.condition,
        p_quantity: parseInt(form.quantity),
        p_location: form.location,
        p_is_rentable: form.is_rentable || false,
        p_price_per_day: parseFloat(form.price_per_day) || 0
    });
    
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else { toast.success("Berhasil disimpan"); setIsOpen(false); fetchItems(); }
  };

  const handleDelete = async (id: string | number) => {
    if (!user) return;
    if(confirm("Hapus barang ini?")) {
        const { error } = await supabase.rpc('delete_inventory_item_secure', {
            p_caller_id: user.id,
            p_id: id.toString()
        });
        if (error) toast.error("Gagal menghapus: " + error.message);
        else { toast.success("Barang dihapus"); fetchItems(); }
    }
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex gap-2"><Box className="text-primary"/> Inventaris Lab</h1>
          <Button onClick={() => { setForm({ name: "", condition: "Baik", quantity: 1, location: "", is_rentable: false, price_per_day: 0 }); setIsOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Tambah Barang</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
             <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari barang..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
             </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Nama Barang</TableHead><TableHead>Kondisi</TableHead><TableHead>Jml</TableHead><TableHead>Lokasi</TableHead><TableHead>Sewa</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                   {filtered.map(item => (
                      <TableRow key={item.id}>
                         <TableCell className="font-medium">{item.name}</TableCell>
                         <TableCell><span className={`px-2 py-1 rounded text-xs border ${item.condition==='Baik'?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{item.condition}</span></TableCell>
                         <TableCell>{item.quantity}</TableCell>
                         <TableCell>{item.location}</TableCell>
                         <TableCell>
                            {item.is_rentable ? (
                               <div className="flex flex-col items-start gap-1">
                                  <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold">YES</span>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Rp {item.price_per_day?.toLocaleString()}</span>
                               </div>
                            ) : (
                               <span className="text-slate-300 text-[10px] font-bold">NO</span>
                            )}
                         </TableCell>
                         <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => { setForm(item); setIsOpen(true); }}><Pencil className="w-4 h-4 text-blue-500"/></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                         </TableCell>
                      </TableRow>
                   ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
           <DialogContent>
              <DialogHeader><DialogTitle>Data Barang</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                 <Input placeholder="Nama Barang" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                 <div className="grid grid-cols-2 gap-4">
                    <Select value={form.condition} onValueChange={v => setForm({...form, condition: v})}>
                       <SelectTrigger><SelectValue/></SelectTrigger>
                       <SelectContent><SelectItem value="Baik">Baik</SelectItem><SelectItem value="Rusak Ringan">Rusak Ringan</SelectItem><SelectItem value="Rusak Berat">Rusak Berat</SelectItem></SelectContent>
                    </Select>
                    <Input type="number" placeholder="Jumlah" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                 </div>
                 <Input placeholder="Lokasi Penyimpanan" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                 
                 <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 shadow-sm border-dashed">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-full ${form.is_rentable ? 'bg-primary/20 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                          <Share2 className="w-4 h-4" />
                       </div>
                       <div>
                          <Label className="text-sm font-bold">Disediakan untuk Sewa/Pinjam</Label>
                          <p className="text-[10px] text-muted-foreground">Aktifkan agar muncul di katalog penyewa umum.</p>
                       </div>
                    </div>
                    <Switch 
                       checked={form.is_rentable} 
                       onCheckedChange={v => setForm({...form, is_rentable: v})} 
                    />
                 </div>

                 {form.is_rentable && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                       <Label className="text-xs mb-1 block">Harga Sewa (Rp / Hari)</Label>
                       <div className="relative">
                          <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                             type="number" 
                             placeholder="Contoh: 10000" 
                             className="pl-9"
                             value={form.price_per_day} 
                             onChange={e => setForm({...form, price_per_day: e.target.value})} 
                          />
                       </div>
                    </div>
                 )}
              </div>
              <DialogFooter><Button onClick={handleSave}>Simpan</Button></DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}