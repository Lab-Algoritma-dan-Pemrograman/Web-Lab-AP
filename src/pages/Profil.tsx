import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, UserCircle, Eye, EyeOff } from "lucide-react";

export default function Profil() {
  const { user: currentUser, login } = useAuth(); // Ambil data user & fungsi update session
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Load data saat halaman dibuka
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name);
      setUsername(currentUser.username);
      // Password tidak kita load dari local storage demi keamanan,
      // User harus input baru jika mau ganti.
    }
  }, [currentUser]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Update Nama ke Supabase (via RPC, tidak akses tabel langsung)
      const { data, error } = await supabase
        .rpc('update_user_profile_secure', {
          p_user_id: currentUser?.id,
          p_full_name: fullName
        });

      if (error) throw error;

      // 2. Update Password (menggunakan fungsi RPC untuk hashing) jika diisi
      if (password && password.length > 0) {
        if (password.length < 3) throw new Error("Password minimal 3 karakter");
        const { error: pwdError } = await supabase.rpc('update_password', {
            p_user_id: currentUser?.id,
            p_new_password: password
        });
        if (pwdError) throw pwdError;
      }

      // 3. Update Session di LocalStorage (biar nama di sidebar berubah)
      const updatedData = Array.isArray(data) ? data[0] : data;
      if (updatedData) {
        // Gabungkan data lama dengan update baru
        const updatedUser = { ...currentUser!, ...updatedData };
        login(updatedUser as any); 
      }

      toast.success("Profil berhasil diperbarui!");
      setPassword(""); // Reset field password

    } catch (error: any) {
      toast.error("Gagal update profil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Profil Saya</h1>
          <p className="text-muted-foreground">Kelola informasi akun Anda.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <UserCircle className="w-10 h-10" />
              </div>
              <div>
                <CardTitle>{currentUser?.full_name}</CardTitle>
                <CardDescription className="capitalize">
                  Role: <span className="font-bold text-primary">{currentUser?.role}</span>
                  {currentUser?.nim && ` | NIM: ${currentUser.nim}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              
              <div className="space-y-2">
                <Label>Username / NIM</Label>
                <Input value={username} disabled className="bg-muted" />
                <p className="text-[10px] text-muted-foreground">Username tidak dapat diubah.</p>
              </div>

              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Nama Lengkap Anda"
                />
              </div>

              <div className="space-y-2">
                <Label>Password Baru</Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Kosongkan jika tidak ingin mengganti password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Perubahan
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}