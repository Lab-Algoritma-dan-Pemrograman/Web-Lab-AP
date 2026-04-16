import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, Send, User, Clock, DownloadCloud, Filter, Link as LinkIcon, Plus, Trash2, ExternalLink } from "lucide-react";
import * as XLSX from "xlsx";

export default function KritikSaran() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [externalLinks, setExternalLinks] = useState<any[]>([]);
  
  // Form State Feedback
  const [category, setCategory] = useState("Fasilitas");
  const [content, setContent] = useState("");

  // Form State Link Eksternal
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Akses & Filter State
  const [hasEditAccess, setHasEditAccess] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");

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
              .eq('menu_key', '/kritik-saran');
              
          if (data && data.length > 0) {
              setHasEditAccess(true);
          }
      }
  };

  const fetchData = async () => {
    if (!user) return;

    // 1. Fetch Feedback via Secure RPC
    const { data: fbData } = await supabase.rpc('get_feedback_secure', { p_viewer_id: user.id });
    
    // Map flattened result back to the structure expected by the UI
    const formattedFb = (fbData || []).map((fb: any) => ({
        ...fb,
        users: {
            full_name: fb.user_full_name,
            username: fb.user_username
        }
    }));
    setFeedbacks(formattedFb);

    // 2. Fetch External Links via Secure RPC
    const { data: linkData } = await supabase.rpc('get_external_links_secure', { p_viewer_id: user.id });
    setExternalLinks(linkData || []);
  };

  useEffect(() => {
    if (user) {
        checkAccess();
        fetchData();
    }
  }, [user]);

  // --- LOGIKA FEEDBACK ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return toast.error("Pesan tidak boleh kosong");
    
    setLoading(true);
    const { error } = await supabase.from('feedback').insert({
      custom_user_id: user?.id,
      category: category,
      content: content
    });

    if (error) {
      toast.error("Gagal mengirim pesan");
    } else {
      toast.success("Terima kasih! Masukan Anda telah terkirim.");
      setContent("");
      fetchData();
    }
    setLoading(false);
  };

  const handleExportExcel = () => {
      if (feedbacks.length === 0) return toast.error("Tidak ada data untuk diexport");

      const loadingToast = toast.loading("Menyiapkan file Excel...");
      try {
          const cleanData = filteredFeedbacks.map((fb, idx) => ({
              "No": idx + 1,
              "Tanggal": new Date(fb.created_at).toLocaleString('id-ID'),
              "Nama Pengirim": fb.users?.full_name || "Anonim",
              "NIM/ID": fb.users?.username || "-",
              "Kategori": fb.category,
              "Isi Pesan": fb.content
          }));

          const worksheet = XLSX.utils.json_to_sheet(cleanData);
          const workbook = XLSX.utils.book_new();
          
          worksheet['!cols'] = [
              { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 50 }
          ];

          XLSX.utils.book_append_sheet(workbook, worksheet, "Kritik dan Saran");
          const today = new Date().toISOString().split('T')[0];
          XLSX.writeFile(workbook, `Rekap_KritikSaran_${today}.xlsx`);

          toast.dismiss(loadingToast);
          toast.success("File Excel berhasil diunduh");
      } catch (err: any) {
          toast.dismiss(loadingToast);
          toast.error("Gagal export: " + err.message);
      }
  };

  const filteredFeedbacks = feedbacks.filter(fb => {
      if (filterCategory === "all") return true;
      return fb.category === filterCategory;
  });


  // --- LOGIKA EXTERNAL LINKS ---
  const handleAddLink = async () => {
      if(!linkTitle || !linkUrl) return toast.error("Judul dan URL harus diisi!");
      
      // Pastikan URL diawali http/https
      let finalUrl = linkUrl;
      if (!/^https?:\/\//i.test(finalUrl)) {
          finalUrl = 'https://' + finalUrl;
      }

      setLoading(true);
      try {
          const { error } = await supabase.from('external_links').insert({
              title: linkTitle,
              url: finalUrl,
              is_active: true
          });
          if(error) throw error;
          
          toast.success("Link berhasil ditambahkan!");
          setLinkTitle(""); setLinkUrl(""); setIsLinkDialogOpen(false);
          fetchData();
      } catch(err: any) {
          // Menangani kemungkinan tabel belum dibuat
          toast.error("Gagal menambah link. Pastikan tabel 'external_links' sudah ada di Supabase!");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteLink = async (id: number) => {
      if(!confirm("Hapus link ini?")) return;
      try {
          const { error } = await supabase.from('external_links').delete().eq('id', id);
          if (error) throw error;
          toast.success("Link dihapus.");
          fetchData();
      } catch (err:any) { toast.error(err.message); }
  };


  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              Kritik & Saran
            </h1>
            <p className="text-muted-foreground">
                {user?.role === 'praktikan' 
                    ? "Sampaikan masukan untuk kemajuan laboratorium." 
                    : "Kelola dan pantau masukan dari praktikan."}
            </p>
          </div>
          
          {/* Tombol Export HANYA untuk Koordinator & Asisten Berhak */}
          {hasEditAccess && (
              <div className="flex gap-2">
                  <Button onClick={handleExportExcel} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                      <DownloadCloud className="w-4 h-4 mr-2" /> Export Excel
                  </Button>
              </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* KOLOM KIRI (Untuk Praktikan Form Input, Untuk Staff Daftar Link) */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* WIDGET EXTERNAL LINKS */}
                <Card className="border-l-4 border-l-blue-500 shadow-md">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2"><LinkIcon className="w-4 h-4 text-blue-600"/> Tautan Penting</CardTitle>
                        </div>
                        
                        {hasEditAccess && (
                            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600"><Plus className="w-5 h-5"/></Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Tambah Link Form</DialogTitle></DialogHeader>
                                    <div className="space-y-4 py-3">
                                        <div className="space-y-2">
                                            <Label>Nama Form / Judul</Label>
                                            <Input placeholder="Contoh: Form Pendaftaran Calon Asisten" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>URL / Link (Google Form, dsb)</Label>
                                            <Input placeholder="https://forms.gle/..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
                                        </div>
                                        <Button onClick={handleAddLink} disabled={loading} className="w-full">Simpan Link</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </CardHeader>
                    <CardContent>
                        {externalLinks.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Belum ada tautan aktif saat ini.</p>
                        ) : (
                            <div className="space-y-3">
                                {externalLinks.map(link => (
                                    <div key={link.id} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-all">
                                        <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline flex-1 truncate">
                                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="truncate">{link.title}</span>
                                        </a>
                                        {hasEditAccess && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteLink(link.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* FORM INPUT KRITIK (HANYA PRAKTIKAN) */}
                {user?.role === 'praktikan' && (
                  <Card className="border-l-4 border-l-primary shadow-md">
                    <CardHeader>
                      <CardTitle>Kirim Masukan Baru</CardTitle>
                      <CardDescription className="text-xs">Identitas Anda tercatat namun privasi tetap kami jaga.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Kategori</label>
                          <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fasilitas">Fasilitas Lab (AC, PC, Kursi)</SelectItem>
                              <SelectItem value="Pelayanan">Pelayanan Asisten</SelectItem>
                              <SelectItem value="Modul">Modul Praktikum</SelectItem>
                              <SelectItem value="Lainnya">Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Isi Pesan</label>
                          <Textarea 
                            rows={5} 
                            placeholder="Tuliskan kritik atau saran Anda secara detail..." 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                          />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full">
                          <Send className="w-4 h-4 mr-2" /> Kirim Masukan
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}
            </div>


            {/* KOLOM KANAN: TABEL RIWAYAT */}
            <div className="lg:col-span-8 flex flex-col">
                <Card className="flex-1 shadow-md">
                  <CardHeader className="pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b bg-gray-50/50">
                    <CardTitle className="text-lg">
                      {user?.role === 'praktikan' ? "Riwayat Masukan Saya" : "Kotak Masuk (Semua Masukan)"}
                    </CardTitle>
                    
                    {/* Filter Kategori HANYA untuk Koordinator & Asisten Berhak */}
                    {hasEditAccess && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 border rounded-md shadow-sm">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[150px] h-7 border-none shadow-none focus:ring-0 px-1 text-sm font-medium">
                                    <SelectValue placeholder="Semua Kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                    <SelectItem value="Fasilitas">Fasilitas</SelectItem>
                                    <SelectItem value="Pelayanan">Pelayanan</SelectItem>
                                    <SelectItem value="Modul">Modul</SelectItem>
                                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 px-0">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                              <TableHead className="w-[120px] text-xs">Tanggal</TableHead>
                              {/* Tampilkan Kolom Pengirim HANYA untuk Asisten/Koordinator */}
                              {(user?.role === 'koordinator' || user?.role === 'asisten') && <TableHead className="text-xs">Pengirim</TableHead>}
                              <TableHead className="w-[120px] text-xs">Kategori</TableHead>
                              <TableHead className="text-xs">Isi Pesan</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFeedbacks.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={(user?.role === 'koordinator' || user?.role === 'asisten') ? 4 : 3} className="text-center py-12 text-muted-foreground">
                                    Belum ada data masukan.
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredFeedbacks.map((fb) => (
                                <TableRow key={fb.id} className="hover:bg-gray-50/50 transition-colors">
                                  <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap align-top pt-4">
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3" />
                                      {new Date(fb.created_at).toLocaleDateString('id-ID')}
                                    </div>
                                  </TableCell>
                                  
                                  {(user?.role === 'koordinator' || user?.role === 'asisten') && (
                                    <TableCell className="align-top pt-3">
                                      <div className="font-medium text-sm flex items-center gap-1.5 text-gray-800">
                                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                                        {fb.users?.full_name || "Anonim"}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground pl-5 mt-0.5 font-mono">{fb.users?.username || "-"}</div>
                                    </TableCell>
                                  )}

                                  <TableCell className="align-top pt-3">
                                    <Badge variant="outline" className="bg-white text-[10px]">{fb.category}</Badge>
                                  </TableCell>
                                  
                                  <TableCell className="max-w-md break-words text-sm text-gray-700 align-top pt-3 leading-relaxed">
                                    {fb.content}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                    </div>
                  </CardContent>
                </Card>
            </div>
        </div>

      </div>
    </DashboardLayout>
  );
}