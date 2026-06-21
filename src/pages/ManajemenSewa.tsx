import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { confirm } from "@/lib/confirm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  ShoppingBag, Search, Check, X, Plane, RefreshCcw, 
  User, Calendar, DollarSign, MessageSquare, Filter, 
  Clock, CheckCircle2, ShoppingCart, ArrowLeftRight, PackageCheck
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ManajemenSewa() {
  const { user } = useAuth();
  const [rentals, setRentals] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const fetchRentals = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_admin_rentals_secure', { p_caller_id: user.id });
    setRentals(data || []);
  };

  useEffect(() => { fetchRentals(); }, [user]);

  const handleUpdateStatus = async (rentalId: number, status: string) => {
    if (!user) return;
    
    // Confirm rejection
    if (status === 'rejected' && !(await confirm("Tolak pengajuan ini?"))) return;

    const { error } = await supabase.rpc('update_rental_status_secure', {
      p_caller_id: user.id,
      p_rental_id: rentalId,
      p_new_status: status
    });

    if (error) {
      toast.error("Gagal update: " + error.message);
    } else {
      toast.success(`Status berhasil diperbarui menjadi ${status}`);
      fetchRentals();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case 'approved': return "bg-blue-100 text-blue-700 border-blue-200";
      case 'active': return "bg-green-100 text-green-700 border-green-200";
      case 'returned': return "bg-slate-100 text-slate-700 border-slate-200";
      case 'rejected': return "bg-red-100 text-red-700 border-red-200";
      default: return "";
    }
  };

  const filtered = rentals.filter(r => 
    r.renter_name.toLowerCase().includes(search.toLowerCase()) || 
    r.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const pendingList = filtered.filter(r => r.status === 'pending');
  const approvedList = filtered.filter(r => r.status === 'approved');
  const activeList = filtered.filter(r => r.status === 'active');
  const finishedList = filtered.filter(r => ['returned', 'rejected'].includes(r.status));

  const openWA = (phoneNumber: string, rental: any) => {
    const phone = phoneNumber.replace(/\D/g, '').replace(/^0/, '62');
    const text = `Halo ${rental.renter_name}, kami dari Admin Lab Algoritma menghubungi mengenai pengajuan ${rental.type} Anda untuk barang: ${rental.item_name}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const RentalTable = ({ data }: { data: any[] }) => (
    <div className="overflow-x-auto scrollbar-thin">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-bold whitespace-nowrap">Penyewa</TableHead>
            <TableHead className="font-bold whitespace-nowrap">Barang</TableHead>
            <TableHead className="font-bold whitespace-nowrap">Waktu</TableHead>
            <TableHead className="font-bold whitespace-nowrap">Biaya</TableHead>
            <TableHead className="text-right font-bold whitespace-nowrap">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                Tidak ada data di kategori ini.
              </TableCell>
            </TableRow>
          ) : (
            data.map(r => (
              <TableRow key={r.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="font-bold text-slate-900">{r.renter_name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {r.renter_phone}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.item_name}</div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] py-0 h-4 bg-slate-50 uppercase">{r.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">x{r.quantity} Unit</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-[11px] font-medium text-slate-700">
                    {format(new Date(r.start_date), "dd MMM", {locale: localeId})} - {format(new Date(r.end_date), "dd MMM yyyy", {locale: localeId})}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs font-bold text-primary">
                    Rp {r.total_price.toLocaleString()}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-green-50 hover:text-green-600" onClick={() => openWA(r.renter_phone, r)}>
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    
                    {r.status === 'pending' && (
                      <>
                        <Button variant="outline" size="icon" className="h-8 w-8 bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200" onClick={() => handleUpdateStatus(r.id, 'approved')}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => handleUpdateStatus(r.id, 'rejected')}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}

                    {r.status === 'approved' && (
                      <Button variant="default" size="sm" className="h-8 text-[11px] bg-green-600 hover:bg-green-700 font-bold" onClick={() => handleUpdateStatus(r.id, 'active')}>
                        Konfirmasi Ambil
                      </Button>
                    )}

                    {r.status === 'active' && (
                      <Button variant="default" size="sm" className="h-8 text-[11px] bg-primary hover:bg-primary/90 font-bold" onClick={() => handleUpdateStatus(r.id, 'returned')}>
                        Konfirmasi Kembali
                      </Button>
                    )}

                    {['returned', 'rejected'].includes(r.status) && (
                       <Badge className={getStatusColor(r.status)} variant="outline">
                         {r.status === 'returned' ? 'Selesai' : 'Ditolak'}
                       </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold flex gap-2 items-center"><ShoppingBag className="text-primary"/> Manajemen Sewa & Pinjam</h1>
          <div className="relative w-full md:w-64">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input placeholder="Cari penyewa/barang..." className="pl-9 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 h-11 p-1 bg-slate-100 rounded-xl">
             <TabsTrigger value="pending" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Clock className="w-4 h-4" /> 
                <span className="hidden sm:inline">Pengajuan Baru</span>
                {pendingList.length > 0 && <Badge className="bg-yellow-500 hover:bg-yellow-500 scale-75 ml-0 md:ml-1">{pendingList.length}</Badge>}
             </TabsTrigger>
             <TabsTrigger value="approved" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <CheckCircle2 className="w-4 h-4" /> 
                <span className="hidden sm:inline">Menunggu Ambil</span>
                {approvedList.length > 0 && <Badge className="bg-blue-500 hover:bg-blue-500 scale-75 ml-0 md:ml-1">{approvedList.length}</Badge>}
             </TabsTrigger>
             <TabsTrigger value="active" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <PackageCheck className="w-4 h-4" /> 
                <span className="hidden sm:inline">Sedang Dipinjam</span>
                {activeList.length > 0 && <Badge className="bg-green-500 hover:bg-green-500 scale-75 ml-0 md:ml-1">{activeList.length}</Badge>}
             </TabsTrigger>
             <TabsTrigger value="history" className="rounded-lg gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <RefreshCcw className="w-4 h-4" /> 
                <span className="hidden sm:inline">Riwayat</span>
             </TabsTrigger>
          </TabsList>

          <Card className="mt-4 border-0 shadow-elevated overflow-hidden">
             <TabsContent value="pending" className="m-0">
                <RentalTable data={pendingList} />
             </TabsContent>
             <TabsContent value="approved" className="m-0">
                <RentalTable data={approvedList} />
             </TabsContent>
             <TabsContent value="active" className="m-0">
                <RentalTable data={activeList} />
             </TabsContent>
             <TabsContent value="history" className="m-0">
                <RentalTable data={finishedList} />
             </TabsContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
