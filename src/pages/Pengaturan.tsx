import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Settings, Smartphone, Info } from "lucide-react";
import { useAuth } from "@/lib/auth";

import { Badge } from "@/components/ui/badge";

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
    // SECURE CHECK
    if (user?.role !== 'koordinator') {
        toast.error("Akses Ditolak", { description: "Hanya Koordinator yang punya kunci ke pengaturan sistem." });
        return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('admin_update_global_settings_secure', {
        p_caller_id: user.id,
        p_semester_active: settings.semester_active || "",
        p_announcement: settings.announcement || "",
        p_is_recruitment_open: settings.is_recruitment_open || false,
        p_wa_templates: settings.wa_templates || null
    });

    if (error) toast.error("Gagal menyimpan pengaturan: " + error.message);
    else toast.success("Pengaturan diperbarui!");
    setLoading(false);
  };

  return (
    <DashboardLayout>
       <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-primary"/> Pengaturan Sistem</h1>
          
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
                    <Label>Pengumuman (Tampil di Login & Beranda)</Label>
                    <Textarea rows={4} value={settings.announcement || ""} onChange={e => setSettings({...settings, announcement: e.target.value})} placeholder="Tulis pengumuman..." />
                 </div>

                 <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                       <Label className="text-base">Buka Pendaftaran Asisten?</Label>
                       <p className="text-sm text-muted-foreground">Aktifkan jika sedang masa Open Recruitment.</p>
                    </div>
                    <Switch checked={settings.is_recruitment_open || false} onCheckedChange={checked => setSettings({...settings, is_recruitment_open: checked})} />
                 </div>
              </CardContent>
           </Card>

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