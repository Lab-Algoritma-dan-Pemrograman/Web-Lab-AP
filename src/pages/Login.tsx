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
  const [signupRole, setSignupRole] = useState<"praktikan" | "penyewa">("praktikan");

  // --- LOGIKA LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        })
      });

      const resData = await res.json();

      if (!res.ok) {
        const errMsg = resData.error || "Gagal melakukan login";
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

    if (signupRole === 'penyewa' && !signupPhone) {
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
        p_nim: signupRole === 'praktikan' ? signupUsername : null,
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
    announcementsList.push({
      type: 'info',
      text: sysSettings.announcement
    });
  }

  if (announcementsList.length === 0) {
    announcementsList.push({
      type: 'info',
      text: 'Selamat Datang di Laboratorium Algoritma Pemrograman'
    });
  }

  // Render elements of announcements
  const combinedElements = announcementsList.map((item, idx) => {
    let content: React.ReactNode;
    if (item.type === 'oprec') {
      content = <span className="text-pink-600 mx-4 font-black">{item.text}</span>;
    } else if (item.type === 'reschedule') {
      content = (
        <span className="mx-4 text-amber-600 flex items-center gap-1.5 shrink-0">
          <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md border border-amber-200 text-[10px]">
            {item.kelas}
          </span>
          <span>{item.text}</span>
        </span>
      );
    } else {
      content = (
        <span className="text-slate-500 mx-4 flex items-center gap-1.5 shrink-0">
          <i className="fa-solid fa-circle-info text-[9px]"></i>
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
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl mb-4 transform -rotate-6 hover:rotate-0 transition-transform shadow-[0_4px_0_#CBD5E1] border-2 border-slate-100 p-1.5">
            <img src="/logo.png" alt="Logo Lab AP" className="w-full h-full object-contain" />
          </div>
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
              <span className="text-pink-500 text-lg leading-none">🎉</span> Info:
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
                    onValueChange={(value: "praktikan" | "penyewa") => setSignupRole(value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full pl-11 py-3.5 h-auto rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm">
                      <SelectValue placeholder="Pilih peran Anda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="praktikan">Praktikan (Mahasiswa)</SelectItem>
                      <SelectItem value="penyewa">Penyewa (Umum)</SelectItem>
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
                  Nomor WhatsApp {signupRole === 'penyewa' && <span className="text-red-500">*</span>}
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
                    required={signupRole === 'penyewa'}
                    disabled={isLoading}
                    className="w-full pl-11 py-3.5 rounded-2xl font-bold transition-all text-sm border-2 bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:border-maroon focus:bg-white focus:ring-4 focus:ring-maroon/5 focus:shadow-sm pr-4 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* NIM / Username */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  {signupRole === 'praktikan' ? 'NIM' : 'Username'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                    <i className="fa-regular fa-user"></i>
                  </div>
                  <input
                    type="text"
                    placeholder={signupRole === 'praktikan' ? "Contoh: 202511090" : "Masukkan Username"}
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
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-900/80 text-sm font-medium leading-relaxed flex gap-3">
              <i className="fa-solid fa-clock text-blue-500 text-lg shrink-0 mt-0.5"></i>
              <p className="whitespace-pre-line">
                {sysSettings?.login_guide_text || "Pembatasan login bertujuan menjaga kestabilan server dan ketertiban praktikum di laboratorium. Pastikan Anda hanya mencoba login ketika sesi shift kelas Anda sedang aktif. Jika Anda menghadapi kendala login darurat, hubungi Asisten PJ kelas Anda."}
              </p>
            </div>
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
              <ol className="list-decimal list-inside space-y-3 font-medium text-slate-700">
                {sysSettings.reschedule_steps.split("\n").filter((l: string) => l.trim()).map((line: string, idx: number) => {
                  const colonIdx = line.indexOf(":");
                  if (colonIdx > -1) {
                    const title = line.substring(0, colonIdx).trim();
                    const desc = line.substring(colonIdx + 1).trim();
                    return (
                      <li key={idx}>
                        <span className="text-slate-900 font-bold">{title}:</span> {desc}
                      </li>
                    );
                  }
                  return (
                    <li key={idx}>
                      {line}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-3 font-medium text-slate-700">
                <li>
                  <span className="text-slate-900 font-bold">Ajukan Izin:</span> Klik menu <strong>Absensi</strong> setelah login, lalu ajukan izin di tab <strong>Izin</strong>.
                </li>
                <li>
                  <span className="text-slate-900 font-bold">Kirim WhatsApp:</span> Klik <strong>Kirim Bukti WA</strong> untuk membagikan berkas pendukung Anda ke Asisten.
                </li>
                <li>
                  <span className="text-slate-900 font-bold">Verifikasi:</span> Tunggu hingga status pengajuan izin berubah menjadi terverifikasi.
                </li>
                <li>
                  <span className="text-slate-900 font-bold">Pilih Slot Baru:</span> Klik <strong>Pilih Jadwal</strong> dan tentukan slot ganti yang kosong.
                </li>
                <li>
                  <span className="text-slate-900 font-bold">ACC Asisten:</span> Tunggu persetujuan jadwal pengganti agar presensi Anda dianggap sah.
                </li>
              </ol>
            )}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 flex gap-2">
              <i className="fa-solid fa-circle-exclamation text-amber-500 mt-0.5 shrink-0"></i>
              <p>Izin dan reschedule wajib diajukan sebelum praktikum kelas pengganti dimulai.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}