import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Settings, Smartphone, Info, BookOpen, ListChecks, CalendarClock, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { triggerServerWhatsApp } from "@/lib/notifications";
import { getDailyQuote } from "@/lib/quotes";

export default function Pengaturan() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
        if (!user) return;
        const { data } = await supabase.rpc('get_system_settings_full_secure', { p_viewer_id: user.id });
        if (data && data.length > 0) setSettings(data[0]);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    if (user?.role !== 'koordinator') {
        toast.error("Akses Ditolak", { description: "Hanya Koordinator yang punya kunci ke pengaturan sistem." });
        return;
    }

    setLoading(true);

    // Parse procedure_text jika berupa string
    let procedureValue = settings.procedure_text;
    if (typeof procedureValue === 'string') {
      try { procedureValue = JSON.parse(procedureValue); } catch { procedureValue = null; }
    }

    const { error } = await supabase.rpc('admin_update_global_settings_secure', {
        p_caller_id: user.id,
        p_semester_active: settings.semester_active || "",
        p_announcement: settings.announcement || "",
        p_is_recruitment_open: settings.is_recruitment_open || false,
        p_wa_templates: settings.wa_templates || null,
        p_recruitment_link: settings.recruitment_link || "",
        p_login_guide_text: settings.login_guide_text || "",
        p_procedure_text: procedureValue || null,
        p_reschedule_steps: settings.reschedule_steps || "",
        p_wa_gateway_provider: settings.wa_gateway_provider || "fonnte",
        p_wa_gateway_token: settings.wa_gateway_token || "",
        p_wa_auto_notify_enabled: settings.wa_auto_notify_enabled !== false,
    });

    if (error) toast.error("Gagal menyimpan pengaturan: " + error.message);
    else toast.success("Pengaturan diperbarui!");
    setLoading(false);
  };

  // Helper: prosedur steps ditampilkan sebagai teks dengan format "Judul: Deskripsi"
  const procedureAsText = () => {
    const p = settings.procedure_text;
    if (!p) return "";
    if (Array.isArray(p)) {
      return p.map((item: any) => `${item.step}: ${item.desc}`).join("\n");
    }
    return typeof p === 'string' ? p : JSON.stringify(p, null, 2);
  };

  const handleProcedureChange = (text: string) => {
    const lines = text.split("\n").filter(l => l.trim());
    const parsed = lines.map(line => {
      const idx = line.indexOf(":");
      if (idx > -1) {
        return { step: line.substring(0, idx).trim(), desc: line.substring(idx + 1).trim() };
      }
      return { step: line.trim(), desc: "" };
    });
    setSettings({ ...settings, procedure_text: parsed });
  };

  return (
    <DashboardLayout>
       <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-primary"/> Pengaturan Sistem</h1>

          {/* KONFIGURASI UMUM */}
          <Card>
             <CardHeader>
                <CardTitle>Konfigurasi Umum</CardTitle>
                <CardDescription>Pengaturan ini akan berdampak pada seluruh pengguna aplikasi.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="space-y-2">
                   <Label>Semester Aktif</Label>
                   <Input value={settings.semester_active || ""} onChange={e => setSettings({...settings, semester_active: e.target.value})} placeholder="Contoh: Genap 2025/2026" />
                </div>

                <div className="space-y-2">
                   <Label>Pengumuman Berjalan (Tampil di Marquee Login)</Label>
                   <Textarea rows={3} value={settings.announcement || ""} onChange={e => setSettings({...settings, announcement: e.target.value})} placeholder="Tulis pengumuman singkat yang akan berjalan di papan info halaman login..." />
                   <p className="text-[10px] text-muted-foreground">Teks ini tampil di papan marquee berjalan halaman login.</p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                   <div className="space-y-0.5">
                      <Label className="text-base">Buka Pendaftaran Asisten?</Label>
                      <p className="text-sm text-muted-foreground">Aktifkan jika sedang masa Open Recruitment.</p>
                   </div>
                   <Switch checked={settings.is_recruitment_open || false} onCheckedChange={checked => setSettings({...settings, is_recruitment_open: checked})} />
                </div>

                {settings.is_recruitment_open && (
                    <div className="space-y-2 p-4 border rounded-lg bg-pink-50/20 border-pink-100 animate-in fade-in duration-200">
                       <Label htmlFor="recruitment-link">Tautan Pendaftaran (Oprec Link)</Label>
                       <Input
                          id="recruitment-link"
                          value={settings.recruitment_link || ""}
                          onChange={e => setSettings({...settings, recruitment_link: e.target.value})}
                          placeholder="Masukkan link pendaftaran (misal Google Form / WhatsApp)"
                       />
                       <p className="text-[10px] text-muted-foreground">Link ini akan muncul di halaman login pada papan pengumuman Oprec.</p>
                    </div>
                 )}
             </CardContent>
          </Card>

          {/* KONTEN MODAL: PANDUAN LOGIN */}
          <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                   <BookOpen className="w-5 h-5"/> Panduan Login (Modal)
                </CardTitle>
                <CardDescription>
                   Teks yang tampil di dalam modal <strong>"Panduan Login"</strong> saat diklik di halaman login.
                </CardDescription>
             </CardHeader>
             <CardContent className="space-y-3">
                <div className="space-y-2">
                   <Label>Isi Panduan Login</Label>
                   <Textarea
                      rows={5}
                      value={settings.login_guide_text || ""}
                      onChange={e => setSettings({...settings, login_guide_text: e.target.value})}
                      placeholder="Pastikan Anda hanya mencoba login ketika sesi shift kelas Anda sedang aktif. Jika Anda menghadapi kendala login darurat, hubungi Asisten PJ kelas Anda."
                   />
                   <p className="text-[10px] text-muted-foreground">Teks bebas. Ditampilkan sebagai paragraf isi pada modal Panduan Login di halaman login.</p>
                </div>
             </CardContent>
          </Card>

          {/* KONTEN MODAL: ALUR PROSEDUR */}
          <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                   <ListChecks className="w-5 h-5"/> Alur Prosedur Praktikan (Modal)
                </CardTitle>
                <CardDescription>
                   Langkah-langkah yang tampil di modal <strong>"Alur Prosedur"</strong>. Format per baris: <code className="bg-slate-100 px-1 rounded text-xs">Judul Langkah: Deskripsi</code>
                </CardDescription>
             </CardHeader>
             <CardContent className="space-y-3">
                <div className="space-y-2">
                   <Label>Langkah-Langkah Prosedur</Label>
                   <Textarea
                      rows={7}
                      value={procedureAsText()}
                      onChange={e => handleProcedureChange(e.target.value)}
                      placeholder={"Pendaftaran Akun: Daftarkan akun menggunakan NIM/ID yang valid.\nMasuk Sistem: Login ke portal dengan NIM dan password saat shift aktif.\nPresensi Kehadiran: Lakukan presensi di menu kehadiran tepat waktu.\nModul & Peminjaman: Unduh modul di menu E-Learning atau ajukan sewa barang lab."}
                   />
                   <div className="flex items-start gap-1.5 p-2 bg-blue-50 rounded-lg text-[10px] text-blue-700">
                      <Info className="w-3 h-3 mt-0.5 shrink-0"/>
                      <span>Format tiap baris: <b>Judul Langkah: Deskripsi singkat.</b> Gunakan Enter untuk memisahkan antar langkah.</span>
                   </div>
                </div>
             </CardContent>
          </Card>

          {/* KONTEN MODAL: LANGKAH RESCHEDULE */}
          <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                   <CalendarClock className="w-5 h-5"/> Langkah Reschedule (Modal)
                </CardTitle>
                <CardDescription>
                   Panduan yang tampil di modal <strong>"Langkah Reschedule"</strong> di halaman login.
                </CardDescription>
             </CardHeader>
             <CardContent className="space-y-3">
                <div className="space-y-2">
                   <Label>Isi Panduan Reschedule</Label>
                   <Textarea
                      rows={6}
                      value={settings.reschedule_steps || ""}
                      onChange={e => setSettings({...settings, reschedule_steps: e.target.value})}
                      placeholder={"Ajukan Izin: Klik menu Absensi setelah login, lalu ajukan izin di tab Izin.\nKirim WhatsApp: Klik Kirim Bukti WA untuk membagikan berkas pendukung ke Asisten.\nVerifikasi: Tunggu hingga status pengajuan izin berubah menjadi terverifikasi.\nPilih Slot Baru: Klik Pilih Jadwal dan tentukan slot ganti yang kosong.\nACC Asisten: Tunggu persetujuan jadwal pengganti agar presensi dianggap sah."}
                   />
                   <p className="text-[10px] text-muted-foreground">Teks bebas multi-baris. Setiap baris menjadi satu butir langkah dalam modal reschedule di halaman login.</p>
                </div>
             </CardContent>
          </Card>

          {/* PENGATURAN WHATSAPP GATEWAY AUTOMATIC BROADCAST */}
          <Card className="border-green-200 bg-green-50/30 shadow-sm">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                   <Send className="w-5 h-5 text-green-600"/> Pengaturan WhatsApp Gateway (Pengiriman Otomatis)
                </CardTitle>
                <CardDescription>
                   Hubungkan penyedia WhatsApp Gateway (Fonnte / Wablas / Whacenter) agar pesan pengingat WA terkirim 100% otomatis dari server tanpa perlu di-klik.
                </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>Penyedia WA Gateway</Label>
                      <Select 
                        value={settings.wa_gateway_provider || "fonnte"} 
                        onValueChange={val => setSettings({...settings, wa_gateway_provider: val})}
                      >
                         <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Provider..."/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="fonnte">Fonnte (Recommended - api.fonnte.com)</SelectItem>
                            <SelectItem value="wablas">Wablas (kudus.wablas.com)</SelectItem>
                            <SelectItem value="whacenter">Whacenter (app.whacenter.com)</SelectItem>
                            <SelectItem value="custom">Custom Webhook HTTP API</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>

                   <div className="space-y-2">
                      <Label>API Token WA Gateway</Label>
                      <Input 
                        type="password"
                        className="bg-white font-mono text-sm"
                        value={settings.wa_gateway_token || ""} 
                        onChange={e => setSettings({...settings, wa_gateway_token: e.target.value})}
                        placeholder="Contoh: xYz123456789Token..."
                      />
                   </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                   <div>
                      <p className="text-sm font-semibold text-green-900">Aktifkan Pengiriman WA Otomatis (Auto Broadcast)</p>
                      <p className="text-xs text-muted-foreground">Kirim pengingat jadwal & reschedule otomatis dari server saat ada perubahan</p>
                   </div>
                   <Switch 
                      checked={settings.wa_auto_notify_enabled !== false} 
                      onCheckedChange={val => setSettings({...settings, wa_auto_notify_enabled: val})}
                   />
                </div>

                <Button 
                   type="button" 
                   variant="outline" 
                   size="sm" 
                   className="border-green-600 text-green-700 bg-white hover:bg-green-50 mt-2"
                   onClick={async () => {
                      if (!user) return;
                      const quote = getDailyQuote("asisten");
                      toast.info("📲 Memicu Uji Kirim WA Otomatis dari Server...");
                      await triggerServerWhatsApp(
                         user.id,
                         `🤖 *Tes WA Gateway Lab AP (Server Auto Broadcast)*\n\nHore! Integrasi WhatsApp Gateway dari server Vercel berhasil terhubung!\n\n🌐 *Buka Web:* https://www.lab-ap.web.id\n\n✨ "${quote}"`
                      );
                   }}
                >
                   <Send className="w-4 h-4 mr-2 text-green-600"/> Uji Kirim WA Otomatis dari Server
                </Button>
             </CardContent>
          </Card>

          {/* TEMPLAT PESAN WHATSAPP */}
          <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                   <Smartphone className="w-5 h-5"/> Templat Pesan WhatsApp
                </CardTitle>
                <CardDescription>
                   Sesuaikan isi pesan otomatis yang akan dikirim melalui WhatsApp. Gunakan placeholder (nama dalam kurung kurawal) untuk data dinamis.
                </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
                <div className="space-y-2">
                   <div className="flex items-center justify-between">
                       <Label>Pesan Izin Praktikan (ke Asisten)</Label>
                       <Badge variant="outline" className="text-[10px]">Untuk Praktikan</Badge>
                   </div>
                   <Textarea
                       rows={3}
                       value={settings.wa_templates?.absen_izin || ""}
                       onChange={e => setSettings({...settings, wa_templates: {...settings.wa_templates, absen_izin: e.target.value}})}
                       placeholder="Contoh: Halo Kak, saya {{nama}} ({{nim}}) ingin izin..."
                   />
                   <div className="flex items-start gap-1 p-2 bg-blue-50 rounded text-[10px] text-blue-700">
                       <Info className="w-3 h-3 mt-0.5 shrink-0"/>
                       <span>Placeholder: <b>{"{{nama}}, {{nim}}, {{kelas}}, {{jurusan}}, {{alasan}}"}</b></span>
                   </div>
                </div>

                <div className="space-y-2">
                   <div className="flex items-center justify-between">
                       <Label>Pesan Swap Jadwal (ke Koordinator)</Label>
                       <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-700 bg-orange-50">Untuk Asisten</Badge>
                   </div>
                   <Textarea
                       rows={3}
                       value={settings.wa_templates?.asisten_swap || ""}
                       onChange={e => setSettings({...settings, wa_templates: {...settings.wa_templates, asisten_swap: e.target.value}})}
                       placeholder="Contoh: Halo Koordinator, saya {{nama}} ingin swap..."
                   />
                   <div className="flex items-start gap-1 p-2 bg-blue-50 rounded text-[10px] text-blue-700">
                       <Info className="w-3 h-3 mt-0.5 shrink-0"/>
                       <span>Placeholder: <b>{"{{nama}}, {{jadwal}}, {{alasan}}"}</b></span>
                   </div>
                </div>

                <div className="space-y-2">
                   <div className="flex items-center justify-between">
                       <Label>Pesan Chat Asisten (dari Jadwal Saya)</Label>
                       <Badge variant="outline" className="text-[10px]">Untuk Praktikan</Badge>
                   </div>
                   <Textarea
                       rows={3}
                       value={settings.wa_templates?.chat_asisten || ""}
                       onChange={e => setSettings({...settings, wa_templates: {...settings.wa_templates, chat_asisten: e.target.value}})}
                       placeholder="Contoh: Selamat {{waktu}} {{panggilan}} {{nama_asisten}}, saya {{nama_praktikan}}..."
                   />
                   <div className="flex items-start gap-1 p-2 bg-green-50 rounded text-[10px] text-green-700 border border-green-100">
                       <Info className="w-3 h-3 mt-0.5 shrink-0"/>
                       <div className="flex flex-col gap-1">
                         <span>Placeholder: <b>{"{{waktu}}, {{panggilan}}, {{nama_asisten}}, {{nama_praktikan}}, {{nim}}, {{jurusan}}, {{kelas}}"}</b></span>
                         <span className="opacity-70 text-[9px]">* waktu: Pagi/Siang/Sore/Malam otomatis. panggilan: Bang/Kak berdasarkan asisten.</span>
                       </div>
                   </div>
                </div>
             </CardContent>
          </Card>

          <div className="pt-2">
             <Button onClick={handleSave} disabled={loading} className="w-full h-12 text-lg shadow-lg">
                 <Save className="w-5 h-5 mr-2"/> {loading ? "Menyimpan..." : "Simpan Semua Pengaturan"}
             </Button>
          </div>
       </div>
    </DashboardLayout>
  );
}