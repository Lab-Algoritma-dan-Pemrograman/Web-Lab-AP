import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { confirm } from "@/lib/confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, Loader2, History, Clock, MessageCircle, RotateCcw, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

import { triggerServerWebPush } from "@/lib/notifications";
import { getDailyQuote } from "@/lib/quotes";

export default function ValidasiAbsensi() {
  const { user } = useAuth();
  const [pendingLogs, setPendingLogs] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // Helper WA Link with Daily Quote
  const getWaLink = (phone: string | null, targetName?: string, isApproved?: boolean) => {
    if (!phone) return "#";
    const cleanPhone = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
    const quote = getDailyQuote("praktikan");
    let msg = `Halo *${targetName || "Praktikan"}*,\n\nPermohonan reschedule praktikum kamu telah diproses.\n\n🌐 *Buka Web Lab AP:* https://www.lab-ap.web.id/absensi\n\n✨ "${quote}"`;
    if (isApproved !== undefined) {
      msg = `Halo *${targetName || "Praktikan"}*,\n\nPermohonan reschedule praktikum kamu telah ${isApproved ? "DISETUJUI ✅" : "DITOLAK ❌"}.\n\n🌐 *Buka Web Lab AP:* https://www.lab-ap.web.id/absensi\n\n✨ "${quote}"`;
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase.rpc('get_attendance_logs_secure', { p_viewer_id: user.id });
    
    // Map to structure expected by UI
    const formatted = (data || []).map((log: any) => ({
      ...log,
      users: {
        full_name: log.user_full_name,
        role: log.user_role,
        phone_number: log.user_phone_number
      },
      schedules: log.reschedule_schedule_id ? {
        id: log.reschedule_schedule_id,
        title: log.schedule_title,
        day_of_week: log.schedule_day,
        start_time: log.schedule_time
      } : null
    }));

    // Filter into Pending and History
    // Pending: Only License requests (status !== Hadir && no reschedule intent)
    const pending = formatted.filter((l: any) => 
      l.verification_status === 'pending' && 
      l.user_role === 'praktikan' && 
      !l.reschedule_schedule_id &&
      l.status !== 'Hadir'
    );

    // History & Reschedule Pool: Needs to include logs with pending reschedules
    const history = formatted.filter((l: any) => 
      l.user_role === 'praktikan' && (
        (['approved', 'rejected'].includes(l.verification_status)) ||
        (l.reschedule_status === 'pending')
      )
    ).slice(0, 50);

    setPendingLogs(pending);
    setHistoryLogs(history);
    setLoading(false);
  };

  // --- EFEK UTAMA & SUPABASE REALTIME ---
  useEffect(() => { 
    fetchData(); 

    // MENYALAKAN FITUR AUTO-REFRESH (REALTIME)
    const channel = supabase
      .channel('validasi_live_updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Dengarkan insert, update, delete
          schema: 'public',
          table: 'attendance_logs',
        },
        (payload) => {
          console.log('Live Update Validasi Diterima!', payload);
          fetchData(); // Langsung refresh data tabel
        }
      )
      .subscribe();

    // Bersihkan channel saat pindah halaman
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleVerifyLicense = async (id: number, isApproved: boolean) => {
    // SECURE CHECK
    if (!['koordinator', 'asisten'].includes(user?.role || '')) {
        toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk memvalidasi izin." });
        return;
    }

    const newStatus = isApproved ? 'approved' : 'rejected';
    
    // Optimistic Update UI (Biar responsif kliknya)
    const item = pendingLogs.find(l => l.id === id);
    if(item) {
        setPendingLogs(prev => prev.filter(l => l.id !== id));
        setHistoryLogs(prev => [{...item, verification_status: newStatus, is_verified: isApproved}, ...prev]);
    }

    const { error } = await supabase.rpc('admin_verify_attendance_secure', {
        p_caller_id: user.id,
        p_log_id: id,
        p_is_approved: isApproved,
        p_type: 'license'
    });

    if (error) {
        toast.error("Gagal memvalidasi: " + error.message);
        fetchData(); // Rollback UI if failed
    } else {
        toast.success(isApproved ? "Izin Disetujui. Praktikan bisa pilih jadwal." : "Izin Ditolak.");
    }
  };

  const handleVerifyReschedule = async (id: number, isApproved: boolean) => {
    // SECURE CHECK
    if (!['koordinator', 'asisten'].includes(user?.role || '')) {
        toast.error("Akses Ditolak");
        return;
    }

    const { error } = await supabase.rpc('admin_verify_attendance_secure', {
        p_caller_id: user.id,
        p_log_id: id,
        p_is_approved: isApproved,
        p_type: 'reschedule'
    });

    if (error) {
        toast.error("Gagal memproses jadwal: " + error.message);
    } else {
        toast.success(isApproved ? "Jadwal Disetujui & Terkunci." : "Jadwal Ditolak.");
        fetchData();
    }
  };

  const handleResetReschedule = async (id: number) => {
    if (!(await confirm("Buka kunci jadwal ini?"))) return;
    
    // SECURE CHECK
    if (!['koordinator', 'asisten'].includes(user?.role || '')) {
        toast.error("Akses Ditolak");
        return;
    }

    // Resetting reschedule can be treated as 'rejecting' a reschedule to clear it
    const { error } = await supabase.rpc('admin_verify_attendance_secure', {
        p_caller_id: user.id,
        p_log_id: id,
        p_is_approved: false,
        p_type: 'reschedule'
    });

    if (error) {
        toast.error("Gagal me-reset: " + error.message);
    } else {
        toast.success("Jadwal di-reset.");
        fetchData();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle className="text-primary"/> Validasi Absensi
          </h1>
          {/* Indikator Realtime Live */}
          <Badge variant="outline" className="text-sm bg-green-50 text-green-600 border-green-200 animate-pulse py-1">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 inline-block"></span> Live Update
          </Badge>
        </div>

        {/* --- TABEL 1: PERMINTAAN IZIN BARU --- */}
        <Card className="border-l-4 border-l-yellow-500 shadow-md">
          <CardHeader><CardTitle className="flex items-center gap-2 text-yellow-700"><Clock className="w-5 h-5"/> Permintaan Izin ({pendingLogs.length})</CardTitle></CardHeader>
          <CardContent>
             {loading && pendingLogs.length === 0 ? <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground w-6 h-6"/></div> :
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[1%] whitespace-nowrap pr-6">Nama</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap pr-6">Alasan</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap pr-6">Kontak</TableHead>
                      <TableHead className="text-center w-[160px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLogs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground italic">Tidak ada permintaan izin baru.</TableCell></TableRow> : 
                      pendingLogs.map(log => (
                         <TableRow key={log.id}>
                            <TableCell>
                              <div className="font-bold">{log.users?.full_name}</div>
                              <div className="text-xs text-muted-foreground">{new Date(log.check_in_time).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="mr-2 mb-1 bg-yellow-50">{log.status}</Badge> 
                              <span className="text-sm">{log.notes}</span>
                            </TableCell>
                            <TableCell>{log.users?.phone_number ? <a href={getWaLink(log.users.phone_number)||'#'} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 bg-green-50 hover:bg-green-100"><MessageCircle className="w-3 h-3 mr-2"/>Chat WA</Button></a> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 mr-2" onClick={() => handleVerifyLicense(log.id, true)}>Setuju</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleVerifyLicense(log.id, false)}>Tolak</Button>
                            </TableCell>
                        </TableRow>
                     ))
                   }
                </TableBody>
              </Table>
            </div>
             }
          </CardContent>
        </Card>

        {/* --- TABEL 2: STATUS JADWAL PENGGANTI --- */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm opacity-95">
          <CardHeader><CardTitle className="flex items-center gap-2 text-blue-700"><History className="w-5 h-5"/> Status Jadwal Pengganti</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                <TableRow><TableHead>Nama</TableHead><TableHead>Status Izin</TableHead><TableHead>Jadwal Dipilih</TableHead><TableHead className="text-right">Aksi Jadwal</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {historyLogs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground italic">Belum ada data riwayat.</TableCell></TableRow> :
                  historyLogs.map((log) => (
                      <TableRow key={log.id} className="bg-gray-50/50">
                          <TableCell>
                              <div className="font-medium">{log.users?.full_name}</div>
                              <div className="text-xs text-muted-foreground">{new Date(log.check_in_time).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
                          </TableCell>
                          <TableCell>
                              {log.verification_status === 'approved' ? <Badge className="bg-green-100 text-green-800 border-transparent">Izin OK</Badge> : <Badge className="bg-red-100 text-red-800 border-transparent">Ditolak</Badge>}
                          </TableCell>
                          
                          {/* INFO JADWAL */}
                          <TableCell>
                              {log.verification_status === 'rejected' ? <span className="text-muted-foreground">-</span> : 
                                !log.reschedule_schedule_id ? <span className="text-xs text-orange-600 italic">Belum pilih jadwal</span> :
                                (
                                  <div className="flex flex-col gap-1 items-start">
                                      <span className="font-bold text-sm text-blue-700">
                                          {log.schedules?.day_of_week}, {log.schedules?.start_time?.slice(0,5)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">({log.schedules?.title})</span>
                                      {log.reschedule_status === 'pending' && <Badge variant="outline" className="w-fit bg-yellow-50 text-yellow-700 border-yellow-200">Menunggu Acc</Badge>}
                                      {log.reschedule_status === 'approved' && <Badge variant="outline" className="w-fit bg-green-50 text-green-700 border-green-200">Disetujui & Fix</Badge>}
                                      {log.reschedule_status === 'rejected' && <Badge variant="outline" className="w-fit bg-red-50 text-red-700 border-red-200">Ditolak</Badge>}
                                  </div>
                                )
                              }
                          </TableCell>

                          {/* AKSI JADWAL */}
                          <TableCell className="text-right">
                              {log.verification_status === 'approved' && log.reschedule_schedule_id && (
                                  <>
                                      {log.reschedule_status === 'pending' && (
                                          <div className="flex justify-end gap-2">
                                              <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700" onClick={() => handleVerifyReschedule(log.id, true)}><CheckCircle className="w-4 h-4 mr-1"/> Acc</Button>
                                              <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => handleVerifyReschedule(log.id, false)}><XCircle className="w-4 h-4 mr-1"/> Tolak</Button>
                                          </div>
                                      )}
                                      {log.reschedule_status === 'approved' && (
                                          <Button size="sm" variant="outline" className="h-8 px-3 text-gray-500" onClick={() => handleResetReschedule(log.id)}><RotateCcw className="w-4 h-4 mr-1"/> Buka Kunci</Button>
                                      )}
                                  </>
                              )}
                          </TableCell>
                      </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}