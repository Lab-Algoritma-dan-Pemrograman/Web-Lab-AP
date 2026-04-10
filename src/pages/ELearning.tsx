import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  GraduationCap, ExternalLink, Loader2, BookOpen, 
  Trophy, Clock, CheckCircle2, AlertCircle, RefreshCw,
  Sparkles, TrendingUp, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || "";
const ELEARNING_URL = import.meta.env.VITE_ELEARNING_URL || "";

// ===== Types =====

interface ElearningProgress {
  id: string;
  nim: string;
  student_name: string | null;
  completed_lessons: number;
  total_lessons: number;
  completion_percentage: number;
  is_completed: boolean;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

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
  const [progress, setProgress] = useState<ElearningProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const userNim = user?.nim || user?.username || "";

  // ===== Fetch Progress from Supabase =====
  const fetchProgress = useCallback(async (showToast = false) => {
    if (!userNim) return;
    
    try {
      const { data, error } = await supabase
        .from("elearning_progress")
        .select("*")
        .eq("nim", userNim)
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        if (showToast) toast.error("Gagal sinkronisasi", { description: error.message });
        return;
      }

      if (data) {
        setProgress(data as ElearningProgress);
        setLastSyncTime(new Date());
        if (showToast) toast.success("Data berhasil disinkronkan!");
      } else {
        setProgress(null);
        if (showToast) toast.info("Belum ada data progress", { description: "Buka E-Learning untuk memulai belajar." });
      }
    } catch (err) {
      console.error("Gagal load progress:", err);
      if (showToast) toast.error("Gagal memuat data progress");
    } finally {
      setLoadingProgress(false);
    }
  }, [userNim]);

  // ===== Initial Load =====
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // ===== Real-time Subscription =====
  useEffect(() => {
    if (!userNim) return;

    const channel = supabase
      .channel("elearning-progress-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "elearning_progress",
          filter: `nim=eq.${userNim}`,
        },
        (payload) => {
          console.log("Realtime update received:", payload);
          
          if (payload.eventType === "DELETE") {
            setProgress(null);
            toast.info("Data progress dihapus");
          } else {
            const data = payload.new as ElearningProgress;
            setProgress(data);
            setLastSyncTime(new Date());
            toast.success("Progress terupdate!", { 
              description: `${data.completed_lessons}/${data.total_lessons} materi selesai`,
              icon: <Sparkles className="h-4 w-4" />
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userNim]);

  // ===== Refresh Handler =====
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchProgress(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // ===== Open E-Learning SSO =====
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
          nim: userNim,
          nama: user.full_name,
          kelas: "",
        },
        JWT_SECRET
      );

      const url = `${ELEARNING_URL}?token=${token}`;
      window.open(url, "_blank");
      toast.success("E-Learning dibuka di tab baru!", {
        description: "Login otomatis via SSO.",
      });
    } catch (err: any) {
      console.error("Gagal generate token:", err);
      toast.error("Gagal membuka E-Learning", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Computed Values =====
  const completionPercent = progress?.completion_percentage ?? 0;
  const isCompleted = progress?.is_completed || completionPercent >= 100;
  const completedLessons = progress?.completed_lessons ?? 0;
  const totalLessons = progress?.total_lessons ?? 0;

  // Format relative time
  const formatRelativeTime = (date: Date | null) => {
    if (!date) return "Belum pernah";
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatLastAccessed = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Belum pernah diakses";
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", { 
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ===== HEADER ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-2 rounded-xl shadow-lg shadow-red-500/20">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              E-Learning Praktikum
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Selesaikan materi pre-lab sebelum mengikuti sesi praktikum.
            </p>
          </div>

          {/* Sync Status & Refresh */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
              <div className={`w-2 h-2 rounded-full ${progress ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span>
                {lastSyncTime ? `Sync: ${formatRelativeTime(lastSyncTime)}` : "Belum tersinkron"}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="gap-1.5 rounded-full"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ===== STATS CARDS ===== */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Progress Materi */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 dark:bg-blue-900/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Progress Materi</CardTitle>
              <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
                <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              {loadingProgress ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="text-sm text-muted-foreground">Memuat...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                      {Math.round(completionPercent)}
                    </span>
                    <span className="text-lg font-semibold text-blue-500/70 mb-0.5">%</span>
                  </div>
                  <div className="mt-3 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${Math.min(completionPercent, 100)}%` }} 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {completedLessons} / {totalLessons || "?"} materi diselesaikan
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status Kurikulum */}
          <Card className={`shadow-sm border-0 overflow-hidden relative ${
            isCompleted 
              ? "bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background" 
              : "bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-background"
          }`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 ${
              isCompleted ? "bg-green-100/50 dark:bg-green-900/20" : "bg-orange-100/50 dark:bg-orange-900/20"
            }`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status Kurikulum</CardTitle>
              <div className={`p-2 rounded-lg ${
                isCompleted ? "bg-green-100 dark:bg-green-900/50" : "bg-orange-100 dark:bg-orange-900/50"
              }`}>
                {isCompleted 
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> 
                  : <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                }
              </div>
            </CardHeader>
            <CardContent className="relative">
              {loadingProgress ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Memuat...</span>
                </div>
              ) : (
                <>
                  <Badge 
                    variant={isCompleted ? "default" : "secondary"} 
                    className={`text-sm px-3 py-1 ${
                      isCompleted 
                        ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800" 
                        : "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                    }`}
                  >
                    {isCompleted ? "✓ Selesai" : "Belum Selesai"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    {isCompleted 
                      ? <><Zap className="h-3 w-3 text-green-500" />Anda sudah dapat mengikuti praktikum.</>
                      : <><TrendingUp className="h-3 w-3 text-orange-500" />Selesaikan semua materi untuk unlock absensi.</>
                    }
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Info Siswa */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-background overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100/50 dark:bg-purple-900/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Informasi</CardTitle>
              <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
                <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              {loadingProgress ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                  <span className="text-sm text-muted-foreground">Memuat...</span>
                </div>
              ) : (
                <>
                  <div className="text-lg font-bold text-purple-700 dark:text-purple-400 truncate">
                    {progress?.student_name || "Belum terdaftar"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {progress?.last_accessed_at 
                      ? `Terakhir: ${formatLastAccessed(progress.last_accessed_at)}`
                      : "Belum pernah mengakses"
                    }
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== OPEN E-LEARNING CTA ===== */}
        <Card className="shadow-sm border-0 bg-gradient-to-r from-red-50 via-white to-red-50/50 dark:from-red-950/20 dark:via-background dark:to-red-950/10">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-red-600 to-red-700 p-3.5 rounded-2xl shadow-lg shadow-red-500/25">
                  <GraduationCap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Buka Platform E-Learning</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Akses materi, kerjakan quiz, dan pantau progress belajar Anda.
                    <br />
                    <span className="text-xs opacity-70">Login otomatis via SSO — tidak perlu login ulang.</span>
                  </p>
                  {progress?.last_accessed_at && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Terakhir diakses: {formatLastAccessed(progress.last_accessed_at)}
                    </p>
                  )}
                </div>
              </div>
              <Button 
                onClick={handleOpenELearning} 
                disabled={isLoading} 
                size="lg" 
                className="min-w-[200px] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/20 transition-all duration-300 hover:shadow-red-500/30"
              >
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan...</>
                ) : (
                  <><ExternalLink className="mr-2 h-4 w-4" />Buka E-Learning</>
                )}
              </Button>
            </div>
            {!ELEARNING_URL && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>URL E-Learning belum dikonfigurasi. Hubungi administrator.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== INFO SECTION ===== */}
        <Card className="shadow-sm border-0 bg-muted/30">
          <CardContent className="pt-6">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Informasi Penting
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Materi pre-lab <strong>wajib</strong> diselesaikan sebelum sesi praktikum dimulai.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>Progress belajar otomatis tersinkronisasi ke sistem absensi secara <strong>real-time</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>Anda harus menyelesaikan <strong>100% materi</strong> agar status kehadiran dapat divalidasi.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span>Jika mengalami kendala, hubungi asisten atau koordinator lab.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
