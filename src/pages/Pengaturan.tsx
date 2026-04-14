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
import { Save, Settings } from "lucide-react";

export default function Pengaturan() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
        const { data } = await supabase.from('system_settings').select('*').single();
        if (data) setSettings(data);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from('system_settings').update({
        semester_active: settings.semester_active,
        announcement: settings.announcement,
        is_recruitment_open: settings.is_recruitment_open
    }).eq('id', settings.id);

    if (error) toast.error("Gagal menyimpan pengaturan");
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

                <Button onClick={handleSave} disabled={loading} className="w-full">
                    <Save className="w-4 h-4 mr-2"/> {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
             </CardContent>
          </Card>
       </div>
    </DashboardLayout>
  );
}