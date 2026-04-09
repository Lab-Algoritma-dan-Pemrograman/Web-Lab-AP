import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  GraduationCap, ExternalLink, Loader2, BookOpen, 
  Trophy, Clock, CheckCircle2, AlertCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || "";
const ELEARNING_URL = import.meta.env.VITE_ELEARNING_URL || "";

// ===== JWT HELPER (Web Crypto API - No external library) =====

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7200 };

  const encodedHeader = textToBase64Url(JSON.stringify(header));
  const encodedPayload = textToBase64Url(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(dataToSign));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

// ===== COMPONENT =====

export default function ELearning() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("elearning_progress")
          .select("*")
          .eq("nim", user.nim || user.username)
          .maybeSingle();
        setProgress(data);
      } catch (err) {
        console.error("Gagal load progress:", err);
      } finally {
        setLoadingProgress(false);
      }
    };
    fetchProgress();
  }, [user]);

  const handleOpenELearning = async () => {
    if (!user) return;
    if (!ELEARNING_URL) {
      toast.error("URL E-Learning belum dikonfigurasi.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await generateJWT(
        {
          nim: user.nim || user.username,
          nama: user.full_name,
          kelas: "",
        },
        JWT_SECRET
      );

      const url = `${ELEARNING_URL}?token=${token}`;
      window.open(url, "_blank");
      toast.success("E-Learning dibuka di tab baru!", {
        description: "Token SSO berhasil digenerate.",
      });
    } catch (err: any) {
      console.error("Gagal generate token:", err);
      toast.error("Gagal membuka E-Learning", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const completionPercent = progress?.completion_percentage ?? 0;
  const isCompleted = completionPercent >= 100;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            E-Learning Praktikum
          </h1>
          <p className="text-muted-foreground mt-1">
            Selesaikan materi pre-lab sebelum mengikuti sesi praktikum.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Progress Materi</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{completionPercent}%</div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(completionPercent, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {progress?.completed_lessons ?? 0} / {progress?.total_lessons ?? "?"} materi selesai
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={`shadow-sm border-l-4 ${isCompleted ? "border-l-green-500" : "border-l-orange-500"}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status Kurikulum</CardTitle>
              {isCompleted ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-orange-600" />}
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Badge variant={isCompleted ? "default" : "secondary"} className={isCompleted ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-orange-100 text-orange-700 hover:bg-orange-100"}>
                    {isCompleted ? "Selesai ✓" : "Belum Selesai"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isCompleted ? "Anda sudah dapat mengikuti praktikum." : "Selesaikan semua materi untuk unlock absensi."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Skor Quiz</CardTitle>
              <Trophy className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{progress?.quiz_score ?? "-"}</div>
                  <p className="text-xs text-muted-foreground mt-1">Skor terakhir dari quiz</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-xl">
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Buka Platform E-Learning</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Akses materi, kerjakan quiz, dan pantau progress belajar Anda.
                    <br />
                    <span className="text-xs">Login otomatis via SSO — tidak perlu login ulang.</span>
                  </p>
                </div>
              </div>
              <Button onClick={handleOpenELearning} disabled={isLoading} size="lg" className="min-w-[200px]">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan...</>
                ) : (
                  <><ExternalLink className="mr-2 h-4 w-4" />Buka E-Learning</>
                )}
              </Button>
            </div>
            {!ELEARNING_URL && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>URL E-Learning belum dikonfigurasi. Hubungi administrator.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-muted/30">
          <CardContent className="pt-6">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Informasi Penting
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Materi pre-lab <strong>wajib</strong> diselesaikan sebelum sesi praktikum dimulai.</li>
              <li>• Progress belajar akan otomatis tersinkronisasi ke sistem absensi.</li>
              <li>• Anda harus menyelesaikan <strong>100% materi</strong> agar status kehadiran dapat divalidasi.</li>
              <li>• Jika mengalami kendala, hubungi asisten atau koordinator lab.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
