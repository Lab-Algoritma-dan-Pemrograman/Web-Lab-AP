import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FloatingIcons } from "@/components/FloatingIcons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);

  // Toggle Password Visibility
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Tab State: 'masuk' | 'daftar'
  const [activeTab, setActiveTab] = useState<"masuk" | "daftar">("masuk");

  // Modal Dialogs States
  const [openPanduan, setOpenPanduan] = useState(false);
  const [openProsedur, setOpenProsedur] = useState(false);
  const [openReschedule, setOpenReschedule] = useState(false);

  // Fetch Settings
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
  const [signupPhone, setSignupPhone] = useState("");
  const [signupRole, setSignupRole] = useState<"mahasiswa" | "peminjam">("mahasiswa");

  // --- LOGIKA LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include", // cookie httpOnly diterima dari server
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = resData.error || (res.status === 404 ? "Endpoint API tidak ditemukan (/api/auth/login). Pastikan Vercel Dev berjalan." : "Gagal melakukan login");
        const errDetails = resData.details || "";
        toast.error(errMsg, errDetails ? { description: errDetails } : undefined);
        setIsLoading(false);
        return;
      }

      const { user: userData, token } = resData;

      if (!userData || !token) {
        toast.error("Gagal Masuk", { description: "Respon server tidak valid." });
        setIsLoading(false);
        return;
      }

      login(userData, token);
      toast.success("Login Berhasil!", { description: `Selamat datang, ${userData.full_name}` });
      navigate("/beranda");
    } catch (err: any) {
      console.error(err);
      toast.error("Terjadi Kesalahan", { description: err.message || "Gagal menghubungi server" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIKA DAFTAR ---
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (signupPassword.length < 6) {
      toast.error("Password terlalu pendek", { description: "Minimal 6 karakter." });
      setIsLoading(false);
      return;
    }

    if (signupRole === 'peminjam' && !signupPhone) {
      toast.error("Mohon Isi WhatsApp!", { description: "Nomor WA wajib diisi agar asisten bisa menghubungi Anda untuk verifikasi identitas." });
      setIsLoading(false);
      return;
    }

    try {
      const { data: usernameExists, error: checkError } = await supabase
        .rpc('check_username_exists', { p_username: signupUsername });

      if (checkError) throw checkError;

      if (usernameExists) {
        toast.error("Gagal Daftar", { description: "ID / NIM sudah terdaftar." });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.rpc('register_user', {
        p_username: signupUsername,
        p_password: signupPassword,
        p_full_name: signupName,
        p_role: signupRole,
        p_nim: signupRole === 'mahasiswa' ? signupUsername : null,
        p_assistant_code: null,
        p_phone_number: signupPhone || null,
        p_is_active: true
      });

      if (error) throw error;

      toast.success("Pendaftaran Berhasil!", { description: "Silakan login dengan akun baru Anda." });

      // Reset & Switch to Login Tab
      setSignupUsername("");
      setSignupPassword("");
      setSignupName("");
      setSignupPhone("");
      setActiveTab("masuk");
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal Daftar", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Build announcements data for Marquee
  const announcementsList: { type: 'oprec' | 'reschedule' | 'info'; text: string; kelas?: string }[] = [];

  if (sysSettings?.is_recruitment_open) {
    announcementsList.push({
      type: 'oprec',
      text: 'OPEN RECRUITMENT ASISTEN SEDANG DIBUKA! DAFTAR SEKARANG'
    });
  }

  if (sysSettings?.active_shift && sysSettings.active_shift !== 'all' && sysSettings.active_shift !== 'none') {
    announcementsList.push({
      type: 'info',
      text: `AKSES LOGIN SHIFT ${sysSettings.active_shift} SEDANG DIBUKA`
    });
  }

  if (sysSettings?.announcement) {
    const isReschedule = /ganti\s*jadwal|reschedule|pindah\s*jadwal|pindah\s*shift|pengganti/i.test(sysSettings.announcement);
    announcementsList.push({
      type: isReschedule ? 'reschedule' : 'info',
      kelas: isReschedule ? 'GANTI JADWAL' : undefined,
      text: sysSettings.announcement
    });
  }

  const hour = new Date().getHours();
  const greetingText = hour < 11
    ? '🌅 Selamat Pagi! Semangat Praktikum Hari Ini!'
    : hour < 15
    ? '☀️ Selamat Siang! Jangan Lupa Istirahat ya~'
    : hour < 19
    ? '🌆 Selamat Sore! Tetap Semangat Belajarnya!'
    : '🌙 Selamat Malam! Tetap Produktif & Jaga Kesehatan!';

  if (announcementsList.length === 0) {
    announcementsList.push({
      type: 'info',
      text: greetingText
    });
  }

  // Render elements of announcements
  const combinedElements = announcementsList.map((item, idx) => {
    let content: React.ReactNode;
    if (item.type === 'oprec') {
      content = (
        <span className="text-pink-600 mx-3 font-black flex items-center gap-1 shrink-0">
          <svg className="w-3 h-3 text-pink-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          {item.text}
          <svg className="w-3 h-3 text-pink-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
        </span>
      );
    } else if (item.type === 'reschedule') {
      content = (
        <span className="mx-3 text-amber-600 flex items-center gap-1.5 shrink-0">
          <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md border border-amber-200 text-[10px]">
            {item.kelas}
          </span>
          <span>{item.text}</span>
        </span>
      );
    } else if (item.text.includes('SHIFT') && sysSettings?.active_shift) {
      content = (
        <span className="mx-3 flex items-center gap-1.5 shrink-0">
          <svg className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          <span className="bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-lg font-black text-[10px]">SHIFT {sysSettings?.active_shift} AKTIF</span>
          <span className="text-amber-600 font-bold">{item.text.replace(`AKSES LOGIN SHIFT ${sysSettings?.active_shift} SEDANG DIBUKA`, 'Login hanya untuk shift ini')}</span>
        </span>
      );
    } else {
      content = (
        <span className="text-slate-500 mx-3 flex items-center gap-1.5 shrink-0">
          <svg className="w-3 h-3 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
          <span>{item.text}</span>
        </span>
      );
    }

    return (
      <span key={idx} className="inline-flex items-center">
        {content}
        {idx < announcementsList.length - 1 && (
          <span className="text-slate-300 mx-2">|</span>
        )}
      </span>
    );
  });

  return (
    <div className="antialiased min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-x-hidden bg-[#F8FAFC]">
      {/* Background Floating Elements */}
      <FloatingIcons />

      {/* Main Container - max-w-[480px] */}
      <div className="w-full max-w-[480px] flex flex-col gap-5 relative z-10 animate-fade-in mt-8 md:mt-0">

        {/* Header/Logo */}
        <div className="text-center mb-2">
          <img src="/logo.png" alt="Logo Lab AP" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-black text-slate-800 leading-tight mb-1">
            Laboratorium Algoritma
          </h1>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Sistem Manajemen Terpadu
          </p>
        </div>

        {/* 1. PAPAN PENGUMUMAN (Marquee) */}
        <div className="flex gap-2 w-full h-[46px]">
          <div className="flex-1 bg-white border-2 border-pink-200 rounded-2xl shadow-[0_4px_0_#FBCFE8] flex items-center overflow-hidden relative">
            {/* Label Statis Kiri */}
            <div className="flex items-center gap-1.5 px-3 h-full font-black text-maroon z-20 bg-white border-r-2 border-pink-100 shrink-0 relative">
              <svg className="w-4 h-4 text-pink-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg> Info:
              <div className="absolute -right-3 top-0 w-3 h-full bg-gradient-to-r from-white to-transparent"></div>
            </div>

            {/* Scrolling Area */}
            <div className="flex-1 overflow-hidden relative flex items-center h-full mask-edges">
              <div className="flex animate-marquee-half whitespace-nowrap text-[11px] font-bold tracking-widest uppercase items-center w-max">
                {combinedElements}
                <span className="text-slate-300 mx-2">|</span>
                {combinedElements}
              </div>
            </div>
          </div>

          {/* Tombol Oprec Statis */}
          {sysSettings?.is_recruitment_open && (
            <a
              href={sysSettings.recruitment_link || "https://bit.ly/OprecAsistenLabAP"}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 bg-pink-500 hover:bg-pink-600 text-white px-4 rounded-xl text-[11px] font-black border-2 border-pink-600 shadow-[0_4px_0_#BE185D] btn-bubbly-action flex items-center justify-center gap-1 h-full"
            >
              Daftar <i className="fa-solid fa-bolt"></i>
            </a>
          )}
        </div>

        {/* 2. KOTAK FORM LOGIN/SIGNUP */}
        <div className="bg-white rounded-[2rem] p-7 border-2 border-slate-100 shadow-[0_8px_0_rgba(203,213,225,0.4)]">
          {/* Custom Tabs Toggle */}
          <div className="bg-slate-50 p-1.5 rounded-2xl flex mb-6 border-2 border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab("masuk")}
              className={`flex-1 py-2 rounded-xl text-sm transition-all font-black focus:outline-none ${activeTab === "masuk"
                  ? "bg-white text-maroon border-2 border-slate-200 shadow-[0_4px_0_rgba(203,213,225,0.4)]"
                  : "text-slate-400 font-bold hover:text-slate-700"
                }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("daftar")}
              className={`flex-1 py-2 rounded-xl text-sm transition-all font-black focus:outline-none ${activeTab === "daftar"
                  ? "bg-white text-maroon border-2 border-slate-200 shadow-[0_4px_0_rgba(203,213,225,0.4)]"
                  : "text-slate-400 font-bold hover:text-slate-700"
                }`}
            >
              Daftar
            </button>
          </div>

          {/* Form Content */}
          {activeTab === "masuk" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* NIM / Username */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  NIM / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-regular fa-user"></i>
                  </div>
                  <input
                    type="text"
                    placeholder="Masukkan NIM atau Username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-4 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-solid fa-lock"></i>
                  </div>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-12 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-maroon transition-colors focus:outline-none"
                  >
                    <i className={`fa-regular ${showLoginPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-bubbly-action w-full mt-4 bg-maroon hover:bg-maroon-light text-white py-4 rounded-2xl font-black text-base border-2 border-maroon-dark shadow-bubbly-maroon flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk Sekarang <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Daftar Sebagai
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                    <i className="fa-solid fa-users"></i>
                  </div>
                  <Select
                    value={signupRole}
                    onValueChange={(value: "mahasiswa" | "peminjam") => setSignupRole(value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full pl-11 py-3.5 h-auto rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm">
                      <SelectValue placeholder="Pilih peran Anda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mahasiswa">Praktikan (Mahasiswa)</SelectItem>
                      <SelectItem value="peminjam">Penyewa (Umum)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-regular fa-id-card"></i>
                  </div>
                  <input
                    type="text"
                    placeholder="Nama Lengkap Anda"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-4 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Nomor WhatsApp {signupRole === 'peminjam' && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-brands fa-whatsapp text-lg"></i>
                  </div>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required={signupRole === 'peminjam'}
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-4 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* NIM / Username */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  {signupRole === 'mahasiswa' ? 'NIM' : 'Username'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-regular fa-user"></i>
                  </div>
                  <input
                    type="text"
                    placeholder={signupRole === 'mahasiswa' ? "Contoh: 202511090" : "Masukkan Username"}
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-4 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-solid fa-lock"></i>
                  </div>
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-12 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-maroon transition-colors focus:outline-none"
                  >
                    <i className={`fa-regular ${showSignupPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-bubbly-action w-full mt-4 bg-maroon hover:bg-maroon-light text-white py-4 rounded-2xl font-black text-base border-2 border-maroon-dark shadow-bubbly-maroon flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Mendaftar...
                  </>
                ) : (
                  <>
                    Daftar Sekarang <i className="fa-solid fa-user-plus"></i>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* 3. MODULAR BOKS PROSEDUR (Grid 3 Buttons) */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {/* Panduan Login */}
          <button
            type="button"
            onClick={() => setOpenPanduan(true)}
            className="bg-white border-2 border-slate-100 rounded-2xl p-3 shadow-[0_4px_0_rgba(203,213,225,0.4)] text-center flex flex-col items-center justify-center gap-2 hover:-translate-y-1 btn-bubbly-action group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-right-to-bracket text-blue-500 text-lg"></i>
            </div>
            <span className="text-[10px] font-black text-slate-500 leading-tight uppercase tracking-wide">
              Panduan<br />Login
            </span>
          </button>

          {/* Alur Prosedur */}
          <button
            type="button"
            onClick={() => setOpenProsedur(true)}
            className="bg-white border-2 border-slate-100 rounded-2xl p-3 shadow-[0_4px_0_rgba(203,213,225,0.4)] text-center flex flex-col items-center justify-center gap-2 hover:-translate-y-1 btn-bubbly-action group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-list-check text-emerald-500 text-lg"></i>
            </div>
            <span className="text-[10px] font-black text-slate-500 leading-tight uppercase tracking-wide">
              Alur<br />Prosedur
            </span>
          </button>

          {/* Langkah Reschedule */}
          <button
            type="button"
            onClick={() => setOpenReschedule(true)}
            className="bg-white border-2 border-slate-100 rounded-2xl p-3 shadow-[0_4px_0_rgba(203,213,225,0.4)] text-center flex flex-col items-center justify-center gap-2 hover:-translate-y-1 btn-bubbly-action group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-calendar-days text-orange-500 text-lg"></i>
            </div>
            <span className="text-[10px] font-black text-slate-500 leading-tight uppercase tracking-wide">
              Langkah<br />Reschedule
            </span>
          </button>
        </div>

      </div>

      {/* Footer Tersembunyi di Mobile */}
      <div className="fixed bottom-4 text-center w-full z-0 hidden md:block">
        <p className="text-[11px] font-bold text-slate-400">
          &copy; 2026 Laboratorium Algoritma Pemrograman.
        </p>
      </div>

      {/* --- DIALOG MODALS --- */}

      {/* Modal Panduan Login */}
      <Dialog open={openPanduan} onOpenChange={setOpenPanduan}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-black">Detail Ketentuan Shift Login</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Panduan Akses Sistem Terpadu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-slate-700 text-sm font-medium">
            {sysSettings?.login_guide_text ? (
              (() => {
                const lines = sysSettings.login_guide_text.split('\n').filter((l: string) => l.trim());
                return lines.map((line: string, idx: number) => {
                  const colonIdx = line.indexOf(':');
                  const title = colonIdx > -1 ? line.substring(0, colonIdx).trim() : `Langkah ${idx + 1}`;
                  const desc = colonIdx > -1 ? line.substring(colonIdx + 1).trim() : line.trim();
                  return (
                    <div key={idx} className={`flex gap-3 items-start ${idx < lines.length - 1 ? 'border-b border-slate-100 pb-3' : ''}`}>
                      <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">{idx + 1}</span>
                      <div>
                        <strong className="text-slate-900 block font-bold">{title}</strong>
                        {desc}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">1</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Cek Shift Aktif</strong>
                    Lihat pengumuman di atas. Login hanya dibuka sesuai shift yang sedang aktif.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">2</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Gunakan NIM/Username</strong>
                    Masukkan NIM (untuk praktikan) atau username yang sudah terdaftar.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">3</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Password Benar</strong>
                    Pastikan password minimal 6 karakter dan sesuai yang didaftarkan.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">4</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Hubungi Asisten</strong>
                    Jika tetap tidak bisa login di shift aktif Anda, segera hubungi Asisten PJ kelas.
                  </div>
                </div>
              </>
            )}
            {sysSettings?.active_shift && sysSettings.active_shift !== 'all' && sysSettings.active_shift !== 'none' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-900/80 text-sm font-medium leading-relaxed">
                <span className="font-black text-amber-700 block mb-1">⚠️ SHIFT AKTIF SAAT INI</span>
                Sistem login hanya dibuka untuk praktikan yang terdaftar di <strong>SHIFT {sysSettings.active_shift}</strong>.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Alur Prosedur */}
      <Dialog open={openProsedur} onOpenChange={setOpenProsedur}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-black">Alur Prosedur Praktikan</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Siklus Aktivitas Praktikum
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-slate-700 text-sm font-medium">
            {sysSettings?.procedure_text && Array.isArray(sysSettings.procedure_text) ? (
              sysSettings.procedure_text.map((item: any, idx: number) => (
                <div key={idx} className={`flex gap-3 items-start ${idx < sysSettings.procedure_text.length - 1 ? 'border-b border-slate-100 pb-3' : ''}`}>
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">{idx + 1}</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">{item.step}</strong>
                    {item.desc}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">1</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Pendaftaran Akun</strong>
                    Daftarkan akun menggunakan NIM/ID yang valid. Pilih peran "Praktikan" untuk mahasiswa kelas atau "Penyewa" untuk umum.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">2</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Masuk Sistem</strong>
                    Login ke portal dengan NIM/username dan password yang telah didaftarkan pada jadwal shift aktif kelas Anda.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">3</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Presensi Kehadiran</strong>
                    Lakukan presensi absensi melalui menu kehadiran tepat waktu saat praktikum dimulai di laboratorium.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">4</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Modul & Peminjaman</strong>
                    Unduh file penunjang praktikum atau ajukan sewa inventaris barang lab langsung melalui halaman khusus.
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Langkah Reschedule */}
      <Dialog open={openReschedule} onOpenChange={setOpenReschedule}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-black">Langkah Reschedule (Ganti Jadwal)</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Prosedur Pengajuan Jadwal Pengganti
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-slate-700 text-sm font-medium">
            {sysSettings?.reschedule_steps ? (
              (() => {
                const lines = sysSettings.reschedule_steps.split('\n').filter((l: string) => l.trim());
                return lines.map((line: string, idx: number) => {
                  const colonIdx = line.indexOf(':');
                  const title = colonIdx > -1 ? line.substring(0, colonIdx).trim() : `Langkah ${idx + 1}`;
                  const desc = colonIdx > -1 ? line.substring(colonIdx + 1).trim() : line.trim();
                  return (
                    <div key={idx} className={`flex gap-3 items-start ${idx < lines.length - 1 ? 'border-b border-slate-100 pb-3' : ''}`}>
                      <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 shrink-0">{idx + 1}</span>
                      <div>
                        <strong className="text-slate-900 block font-bold">{title}</strong>
                        {desc}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 shrink-0">1</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Ajukan Izin</strong>
                    Buka menu <strong>Absensi</strong> setelah login, lalu isi form Izin/Sakit di tab <strong>Izin</strong>.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 shrink-0">2</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Kirim Bukti WA</strong>
                    Klik tombol <strong>Kirim Bukti WA</strong> pada riwayat untuk kirim berkas ke Asisten.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 shrink-0">3</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Tunggu Verifikasi</strong>
                    Status izin akan berubah jika Asisten sudah memverifikasi.
                  </div>
                </div>
                <div className="flex gap-3 items-start border-b border-slate-100 pb-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 shrink-0">4</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Pilih Jadwal Baru</strong>
                    Klik <strong>Pilih Jadwal</strong> pada riwayat izin untuk memilih slot ganti yang tersedia.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 shrink-0">5</span>
                  <div>
                    <strong className="text-slate-900 block font-bold">Tunggu ACC</strong>
                    Tunggu persetujuan Asisten agar presensi jadwal pengganti dianggap sah.
                  </div>
                </div>
              </>
            )}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 flex gap-2">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
              <p>Izin dan reschedule wajib diajukan sebelum praktikum kelas pengganti dimulai.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}