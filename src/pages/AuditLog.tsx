import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Search, Filter, Clock, User, ClipboardList, Database, Eye, Loader2, RefreshCw, ChevronLeft, ChevronRight
} from "lucide-react";

export default function AuditLog() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionType, setActionType] = useState("all");
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [hasMore, setHasMore] = useState(true);

  // Dialog State
  const [selectedPayload, setSelectedPayload] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Debouncing search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const { data, error } = await supabase.rpc("get_audit_logs_secure", {
        p_viewer_id: user.id,
        p_search: debouncedSearch || null,
        p_action_type: actionType === "all" ? null : actionType,
        p_limit: limit + 1, // Fetch limit + 1 to determine if there's a next page
        p_offset: offset
      });

      if (error) {
        throw error;
      }

      const results = data || [];
      if (results.length > limit) {
        setHasMore(true);
        setLogs(results.slice(0, limit));
      } else {
        setHasMore(false);
        setLogs(results);
      }
    } catch (err: any) {
      console.error("Gagal mengambil audit log:", err);
      toast.error("Gagal memuat log riwayat aktivitas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [debouncedSearch, actionType, page]);

  const handleRefresh = () => {
    setPage(1);
    fetchLogs();
    toast.success("Log riwayat aktivitas berhasil diperbarui! 🔄✨");
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("DELETE")) return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100";
    if (act.includes("UPDATE")) return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100";
    if (act.includes("INSERT") || act.includes("CREATE")) return "bg-green-100 text-green-700 border-green-200 hover:bg-green-100";
    if (act.includes("LOGIN")) return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100";
    return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100";
  };

  const formatIndonesianDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (e) {
      return dateString;
    }
  };

  const openPayloadDialog = (payload: any) => {
    setSelectedPayload(payload);
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2 text-primary uppercase tracking-tight">
              <ClipboardList className="w-6 h-6 text-maroon transform -rotate-3"/> Audit Log Aktivitas
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Pantau dan verifikasi setiap perubahan data yang terjadi dalam sistem Lab AP.</p>
          </div>
          
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="border-maroon/20 text-maroon hover:bg-maroon-bg rounded-xl font-bold transition-all hover:scale-105 duration-200"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}/>
            Segarkan
          </Button>
        </div>

        {/* FILTER & PENCARIAN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          {/* SEARCH BAR */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari berdasarkan nama aktor atau deskripsi aktivitas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 border-gray-200 focus:border-maroon focus:ring-maroon rounded-xl font-medium"
            />
          </div>

          {/* ACTION TYPE FILTER */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-1 bg-white h-11">
            <Filter className="w-4 h-4 text-gray-400 shrink-0"/>
            <Select value={actionType} onValueChange={(val) => { setActionType(val); setPage(1); }}>
              <SelectTrigger className="border-none bg-transparent h-full w-full focus:ring-0 font-bold text-gray-600">
                <SelectValue placeholder="Tipe Aksi" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Semua Aksi</SelectItem>
                <SelectItem value="LOGIN">LOGIN</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="BATCH_REGISTER">BATCH REGISTER</SelectItem>
                <SelectItem value="RESET_PLOTTING">RESET PLOTTING</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* TABEL LOG */}
        <Card className="border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4 px-6">
            <CardTitle className="text-lg font-black text-dark flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" /> Riwayat Log Aktivitas ({logs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="font-extrabold text-gray-700 py-3 px-6">Waktu & Tanggal</TableHead>
                  <TableHead className="font-extrabold text-gray-700 py-3 px-6">Aktor</TableHead>
                  <TableHead className="font-extrabold text-gray-700 py-3 px-6">Tipe Aksi</TableHead>
                  <TableHead className="font-extrabold text-gray-700 py-3 px-6">Deskripsi</TableHead>
                  <TableHead className="font-extrabold text-gray-700 text-center py-3 px-6">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-primary w-8 h-8"/>
                        <p className="text-sm font-bold text-gray-500">Sedang memuat data log...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground font-medium">
                      Tidak ada log riwayat aktivitas yang ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50/30 transition-colors">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {formatIndonesianDate(log.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-bold text-dark text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center border shrink-0">
                            <User className="w-4 h-4"/>
                          </div>
                          <div>
                            <p className="leading-tight">{log.actor_name}</p>
                            {log.actor_id && <p className="text-[10px] text-gray-400 font-bold mt-0.5">ID: #{log.actor_id}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className={`font-black tracking-wider text-[10px] rounded-lg border px-2 py-0.5 ${getActionBadgeColor(log.action_type)}`}>
                          {log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-semibold text-gray-600 text-sm max-w-xs xl:max-w-md truncate" title={log.description}>
                        {log.description || "-"}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-center">
                        {log.payload ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-maroon hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => openPayloadDialog(log.payload)}
                            title="Lihat Detail JSON Payload"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400 font-bold">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* PAGINATION */}
        {!loading && logs.length > 0 && (
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400">Halaman {page}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl font-bold border-gray-200"
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1"/> Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl font-bold border-gray-200"
                onClick={() => setPage(prev => prev + 1)}
                disabled={!hasMore}
              >
                Selanjutnya <ChevronRight className="w-4 h-4 ml-1"/>
              </Button>
            </div>
          </div>
        )}

        {/* JSON PAYLOAD PREVIEW DIALOG */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl bg-[#FDFBF7] border-2 border-gray-100 shadow-bubbly-dark">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-dark uppercase tracking-tight flex items-center gap-2">
                📂 Detail Payload Data
              </DialogTitle>
              <DialogDescription className="text-sm font-semibold text-gray-500">
                Data JSON payload dari aksi yang terekam dalam log aktivitas.
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-white/80 border border-gray-200 rounded-xl p-4 max-h-[350px] overflow-y-auto font-mono text-xs text-gray-700 leading-relaxed shadow-inner">
              <pre className="whitespace-pre-wrap word-break-all">
                {selectedPayload ? JSON.stringify(selectedPayload, null, 2) : "Tidak ada data."}
              </pre>
            </div>

            <DialogFooter>
              <Button 
                onClick={() => setIsDialogOpen(false)} 
                className="w-full bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-bold border-2 border-slate-600 shadow-bubbly-slate hover:-translate-y-0.5 duration-200"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
