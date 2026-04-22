import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { QrCode, StopCircle, Play, Loader2 } from "lucide-react";

export default function BuatQR() {
  const { user } = useAuth();
  
  // --- STATE PILIHAN ---
  const [meetingType, setMeetingType] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  
  // --- STATE SESI ---
  const [title, setTitle] = useState(""); 
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);

  // --- DATA BAKU ---
  const meetingOptions = [
    "Pengarahan", "Modul 1", "Modul 2", "Modul 3", "Modul 4&5", "Modul 6", "Presentasi"
  ];

  const majorOptions = [
    "S1 Teknik Tenaga Listrik",
    "S1 Teknik Elektro",
    "S1 Teknik Sistem Energi",
    "D3 Teknologi Listrik",
  ];

  const classOptions = [
    "A", "B", "C", "D", "E",
  ];

  // --- UPDATE TOKEN OTOMATIS (5 DETIK) ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (sessionId && user) {
      intervalId = setInterval(async () => {
        const newToken = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8);
        // Update DB via Secure RPC
        const { error } = await supabase.rpc('update_qr_session_token_secure', {
            p_caller_id: user.id,
            p_id: sessionId,
            p_token: newToken
        });
        if (!error) {
          setQrToken(newToken);
          setTimeLeft(5);
        }
      }, 5000);
    }
    return () => clearInterval(intervalId);
  }, [sessionId, user]);

  // --- COUNTDOWN VISUAL ---
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (sessionId && timeLeft > 0) {
      timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timerId);
  }, [sessionId, timeLeft, qrToken]);

  // --- MULAI SESI ---
  const handleStartSession = async () => {
    // Validasi Input
    if (!meetingType || !selectedMajor || !selectedClass) {
      return toast.error("Lengkapi semua pilihan (Pertemuan, Jurusan, & Kelas)!");
    }
    if (!user) return;
    
    setLoading(true);

    // Gabungkan String: "Modul 1 - Teknik Elektro A"
    const generatedTitle = `${meetingType} - ${selectedMajor} ${selectedClass}`;
    setTitle(generatedTitle);

    const firstToken = Math.random().toString(36).substring(2, 15);

    const { data: sessionData, error } = await supabase.rpc('upsert_qr_session_secure', {
      p_caller_id: user.id,
      p_title: generatedTitle,
      p_token: firstToken
    });

    if (error) {
      toast.error("Gagal: " + error.message);
    } else if (sessionData && sessionData.length > 0) {
      setSessionId(sessionData[0].id);
      setQrToken(firstToken);
      setTimeLeft(5);
      toast.success(`Sesi Dimulai: ${generatedTitle}`);
    }
    setLoading(false);
  };

  // --- STOP SESI ---
  const handleStopSession = async () => {
    if (!sessionId || !user) return;
    const { error } = await supabase.rpc('stop_qr_session_secure', {
        p_caller_id: user.id,
        p_id: sessionId
    });
    if (error) toast.error("Gagal menghentikan: " + error.message);
    else {
        setSessionId(null);
        setQrToken(null);
        setTitle("");
        toast.info("Sesi Dihentikan.");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6 text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <QrCode className="text-primary"/> Generator Absensi
        </h1>

        {!sessionId ? (
          // --- FORM INPUT ---
          <Card>
            <CardHeader>
              <CardTitle>Buat Sesi Baru</CardTitle>
              <CardDescription>Pilih detail kelas di bawah ini.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* 1. Pilih Pertemuan */}
              <div className="space-y-2 text-left">
                <Label>Jenis Pertemuan</Label>
                <Select value={meetingType} onValueChange={setMeetingType}>
                  <SelectTrigger><SelectValue placeholder="Pilih Modul..." /></SelectTrigger>
                  <SelectContent>
                    {meetingOptions.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Pilih Jurusan */}
              <div className="space-y-2 text-left">
                <Label>Program Studi / Jurusan</Label>
                <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                  <SelectTrigger><SelectValue placeholder="Pilih Jurusan..." /></SelectTrigger>
                  <SelectContent>
                    {majorOptions.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Pilih Kelas */}
              <div className="space-y-2 text-left">
                <Label>Kelas Paralel</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas (A/B/C..." /></SelectTrigger>
                  <SelectContent>
                    {classOptions.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleStartSession} disabled={loading} className="w-full mt-4">
                {loading ? <Loader2 className="animate-spin"/> : <Play className="w-4 h-4 mr-2"/>} 
                Mulai Sesi
              </Button>
            </CardContent>
          </Card>
        ) : (
          // --- TAMPILAN SESI AKTIF ---
          <Card className="border-4 border-green-500 animate-pulse-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-green-600 animate-pulse">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pb-8">
              <div className="p-4 bg-white rounded-xl shadow-lg relative">
                {qrToken && <QRCode value={qrToken} size={256} />}
              </div>

              <Button variant="destructive" size="lg" onClick={handleStopSession} className="w-full">
                <StopCircle className="mr-2 h-5 w-5"/> Hentikan Sesi
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}