import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Megaphone, PartyPopper, Zap } from "lucide-react"; 

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);

  // Fetch settings once for Marquee
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.rpc('get_public_settings');
      if (data && data.length > 0) {
        setSysSettings(data[0]);
      }
    };
    fetchSettings();
  }, []);

  // --- State untuk Login ---
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // --- State untuk Daftar ---
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  
  // UPDATE: Role hanya dibatasi untuk Praktikan atau Penyewa
  const [signupRole, setSignupRole] = useState<"praktikan" | "penyewa">("praktikan");

  // --- LOGIKA LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Verifikasi kredensial menggunakan fungsi RPC (Aman dengan Hash)
      const { data, error } = await supabase
        .rpc('login_user', { 
            p_username: loginUsername, 
            p_password: loginPassword
        })
        .maybeSingle();

      if (error) throw error;

      // 2. Validasi (Jika data null artinya username salah atau password salah)
      if (!data) {
        toast.error("Gagal Masuk", { description: "Username tidak ditemukan atau password salah!" });
      } else if (!data.is_active) {
        // CEK STATUS AKTIF
        toast.error("Gagal Masuk", { description: "Akun Anda sedang dinonaktifkan." });
      } else {
        // 3. CEK SHIFT AKTIF (Khusus Praktikan)
        if (data.role === 'praktikan') {
          const { data: settings } = await supabase
            .from('system_settings')
            .select('active_shift')
            .maybeSingle();
          
          const activeShift = settings?.active_shift || 'all';
          
          if (activeShift !== 'all') {
            if (activeShift === 'none') {
               toast.error("Akses Ditutup", { description: "Maaf, akses login saat ini sedang ditutup untuk semua praktikan." });
               setIsLoading(false);
               return;
            }
            if (!data.shift || data.shift === '?') {
               toast.error("Akun Belum Aktif", { description: "Mohon tunggu plotting shift dari Koordinator sebelum Anda bisa login." });
               setIsLoading(false);
               return;
            }
            if (data.shift !== activeShift) {
               toast.error("Akses Ditolak", { description: `Maaf, akun Anda terdaftar di Shift ${data.shift}. Saat ini hanya Shift ${activeShift} yang diizinkan masuk.` });
               setIsLoading(false);
               return;
            }
          }
        }

        // 4. Login Sukses
        // Hapus field sensitif agar tidak tersimpan di localStorage browser
        const { password: _, ...safeData } = data as any;
        
        login(safeData as any); 
        toast.success("Login Berhasil!", { description: `Selamat datang, ${data.full_name}` });
        
        // Redirect cerdas berdasarkan role
        if (data.role === 'koordinator' || data.role === 'asisten') {
            navigate("/beranda");
        } else {
            navigate("/beranda"); 
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Terjadi Kesalahan", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIKA DAFTAR (HANYA PRAKTIKAN & PENYEWA) ---
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (signupPassword.length < 3) {
      toast.error("Password terlalu pendek", { description: "Minimal 3 karakter." });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Cek apakah username sudah dipakai?
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', signupUsername)
        .maybeSingle();

      if (existingUser) {
        toast.error("Gagal Daftar", { description: "ID / NIM sudah terdaftar." });
        setIsLoading(false);
        return;
      }

      // 2. Masukkan data baru menggunakan RPC (otomatis melakukan hashing password)
      const { error } = await supabase.rpc('register_user', {
        p_username: signupUsername,
        p_password: signupPassword,
        p_full_name: signupName,
        p_role: signupRole,
        p_nim: signupRole === 'praktikan' ? signupUsername : null,
        p_assistant_code: null,
        p_is_active: true
      });

      if (error) throw error;

      toast.success("Pendaftaran Berhasil!", { description: "Silakan login dengan akun baru Anda." });
      
      // Reset Form
      setSignupUsername("");
      setSignupPassword("");
      setSignupName("");
      // Kembalikan ke tab Login (Opsional, manual user klik tab Login)

    } catch (err: any) {
      console.error(err);
      toast.error("Gagal Daftar", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          {/* Kotak Putih untuk Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4">
            <img src="/logo.png" alt="Logo Lab Algoritma" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Laboratorium Algoritma Pemrograman
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistem Manajemen Laboratorium
          </p>
        </div>

        {/* MARQUEE PENGUMUMAN */}
        {sysSettings && (
            <div className="mb-6 overflow-hidden rounded-lg bg-white border border-primary/20 shadow-sm p-3 relative flex items-center">
                <div className="flex-shrink-0 z-10 bg-white pr-2 flex items-center gap-2 text-primary font-bold">
                    {sysSettings.is_recruitment_open ? <PartyPopper className="w-5 h-5 text-pink-500 animate-bounce" /> : <Megaphone className="w-5 h-5 animate-pulse" />}
                    Info:
                </div>
                <div className="flex-1 overflow-hidden whitespace-nowrap relative">
                    <div className="animate-marquee inline-block whitespace-nowrap text-sm font-medium text-slate-700">
                        <div className="inline-flex items-center gap-2 mr-10 relative">
                            <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500 animate-pulse" />
                            {sysSettings.is_recruitment_open && <span className="text-pink-600 font-bold">🔥 OPEN RECRUITMENT ASISTEN SEDANG DIBUKA! DAFTAR SEKARANG! 🔥</span>}
                            {sysSettings.active_shift && sysSettings.active_shift !== 'all' && sysSettings.active_shift !== 'none' && (
                                <span className="text-blue-600 font-bold">🔔 PERHATIAN: Akses Login Praktikum Saat Ini Hanya Dibuka Untuk SHIFT {sysSettings.active_shift}. 🔔</span>
                            )}
                            <span>{sysSettings.announcement || "Selamat datang di sistem informasi Laboratorium Algoritma Pemrograman."}</span>
                        </div>
                        {/* Duplicate for seamless loop if needed, but animate-marquee with single long text usually works with transform -100% */}
                    </div>
                </div>
            </div>
        )}

        {/* Card Form */}
        <Card className="border-0 shadow-elevated">
          <Tabs defaultValue="masuk" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="masuk">Masuk</TabsTrigger>
                <TabsTrigger value="daftar">Daftar</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* --- TAB LOGIN (Untuk Semua Role) --- */}
              <TabsContent value="masuk" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">NIM</Label>
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Masukkan NIM"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Masukkan password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* --- TAB DAFTAR (Hanya Praktikan & Penyewa) --- */}
              <TabsContent value="daftar" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  
                  {/* Pilihan Role Ditaruh Paling Atas agar Label di bawahnya menyesuaikan */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Daftar Sebagai</Label>
                    <Select
                      value={signupRole}
                      onValueChange={(value: "praktikan" | "penyewa") => setSignupRole(value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih peran Anda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="praktikan">Praktikan (Mahasiswa)</SelectItem>
                        <SelectItem value="penyewa">Penyewa (Umum)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nama Lengkap</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Nama Lengkap Anda"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    {/* Label Dinamis: NIM atau Username/NIK */}
                    <Label htmlFor="signup-username">
                      {signupRole === 'praktikan' ? 'NIM' : 'NIK / Username'}
                    </Label>
                    <Input
                      id="signup-username"
                      type="text" 
                      placeholder={signupRole === 'praktikan' ? "Contoh: 202511090" : "Masukkan NIM"}
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Minimal 3 karakter"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mendaftar...
                      </>
                    ) : (
                      "Daftar Sekarang"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 Laboratorium Algoritma Pemrograman.
        </p>
      </div>
    </div>
  );
}