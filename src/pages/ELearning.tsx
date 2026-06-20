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
import { createClient } from "@supabase/supabase-js";

const ELEARNING_SUPABASE_URL = "https://tvsawtkevzfqobsfkiag.supabase.co";
const ELEARNING_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2c2F3dGtldnpmcW9ic2ZraWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njk3MDQsImV4cCI6MjA4OTM0NTcwNH0.bO8dU2ic4dv4pYWIvHrf9InoTDMdLXnr1ZK1paCu8Zo";

const elearningSupabase = createClient(ELEARNING_SUPABASE_URL, ELEARNING_SUPABASE_ANON_KEY);

const ELEARNING_URL = import.meta.env.VITE_ELEARNING_URL || "";

// ===== JWT via Server API (Secret never reaches the browser) =====

async function requestJWT(userId: number): Promise<string> {
  // 1. Get Secure Handshake from Database
  const { data: handshakeCode, error: rpcError } = await supabase.rpc('get_elearning_handshake_secure', { 
    p_viewer_id: userId 
  });

  if (rpcError || !handshakeCode) {
    throw new Error("Gagal melakukan verifikasi keamanan. Harap coba lagi.");
  }

  // 2. Exchange Handshake for JWT via Backend API
  const res = await fetch("/api/generate-jwt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handshake_code: handshakeCode }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  const data = await res.json();
  return data.token;
}

// ===== Types =====

interface ElearningProgress {
  id: string;
  nim: string;
  student_name: string | null;
  completed_lessons: number;
  total_lessons: number;
  completion_percentage: number;
  is_completed: boolean;
  completed_levels: string[] | null;
  current_level: string | null;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
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
    if (!user || !userNim) return;

    try {
      // 1. Fetch levels, modules, lessons
      const { data: levelsData, error: levelsError } = await elearningSupabase
        .from('levels')
        .select('*, modules(*, lessons(*))');

      if (levelsError) throw levelsError;

      // 2. Fetch student progress
      const { data: progressData, error: progressError } = await elearningSupabase
        .from('student_progress')
        .select('*')
        .eq('nim', userNim);

      if (progressError) throw progressError;

      // 3. Fetch active session
      const { data: sessionData } = await elearningSupabase
        .from('active_sessions')
        .select('*')
        .eq('nim', userNim)
        .maybeSingle();

      const completedLessonIds = (progressData || [])
        .filter(p => p.completed)
        .map(p => p.lesson_id);

      let totalLessonsCount = 0;
      let completedLessonsCount = completedLessonIds.length;
      const completedLevels: string[] = [];
      let currentLevelTitle: string | null = null;

      if (levelsData) {
        // Sort levels by sort_order
        const sortedLevels = [...levelsData].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        for (const lvl of sortedLevels) {
          let lvlTotal = 0;
          let lvlDone = 0;
          
          // Sort modules by sort_order
          const sortedModules = [...(lvl.modules || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          
          for (const mod of sortedModules) {
            // Sort lessons by sort_order
            const sortedLessons = [...(mod.lessons || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            
            for (const lsn of sortedLessons) {
              lvlTotal++;
              totalLessonsCount++;
              if (completedLessonIds.includes(lsn.id)) {
                lvlDone++;
              }
            }
          }
          
          if (lvlTotal > 0 && lvlDone >= lvlTotal) {
            completedLevels.push(lvl.title);
          } else if (lvlDone > 0 && !currentLevelTitle) {
            currentLevelTitle = lvl.title;
          }
        }
        
        // Fallback for current level if none is partially completed but some are incomplete
        if (!currentLevelTitle) {
          const firstIncomplete = sortedLevels.find(lvl => {
            const lvlLessons = (lvl.modules || []).flatMap((m: any) => m.lessons || []);
            const lvlTotal = lvlLessons.length;
            const lvlDone = lvlLessons.filter((l: any) => completedLessonIds.includes(l.id)).length;
            return lvlTotal > 0 && lvlDone < lvlTotal;
          });
          if (firstIncomplete) {
            currentLevelTitle = firstIncomplete.title;
          }
        }
      }

      const completionPercent = totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 105 : 0; // scaled matching completion_percentage formatting
      const finalPercentage = Math.min(100, Math.round(completionPercent * 100) / 100);

      let lastAccessed: string | null = null;
      if (sessionData?.last_heartbeat) {
        lastAccessed = sessionData.last_heartbeat;
      } else if (progressData && progressData.length > 0) {
        const dates = progressData.map(p => p.completed_at ? new Date(p.completed_at).getTime() : 0);
        const maxDate = Math.max(...dates);
        if (maxDate > 0) {
          lastAccessed = new Date(maxDate).toISOString();
        }
      }

      const computedProgress: ElearningProgress = {
        id: user.id.toString(),
        nim: userNim,
        student_name: user.nama || user.full_name || 'Mahasiswa',
        completed_lessons: completedLessonsCount,
        total_lessons: totalLessonsCount,
        completion_percentage: finalPercentage,
        is_completed: totalLessonsCount > 0 && completedLessonsCount >= totalLessonsCount,
        completed_levels: completedLevels,
        current_level: currentLevelTitle || 'Belum Mulai',
        last_accessed_at: lastAccessed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setProgress(computedProgress);
      setLastSyncTime(new Date());

      // Kirim hasil sinkronisasi ke database utama Web Lab AP secara aman
      try {
        const { error: dbSyncError } = await supabase.rpc('save_elearning_progress_secure', {
          p_caller_id: user.id, // Akan ditimpa oleh server proxy dari JWT
          p_nim: userNim,
          p_student_name: computedProgress.student_name,
          p_completed_lessons: computedProgress.completed_lessons,
          p_total_lessons: computedProgress.total_lessons,
          p_completion_percentage: computedProgress.completion_percentage,
          p_is_completed: computedProgress.is_completed,
          p_completed_levels: computedProgress.completed_levels,
          p_current_level: computedProgress.current_level,
          p_last_accessed_at: computedProgress.last_accessed_at
        });
        
        if (dbSyncError) {
          console.error("Gagal menyinkronkan data progres ke database utama:", dbSyncError.message);
        } else {
          console.log("Progres E-Learning berhasil disinkronkan ke database utama.");
        }
      } catch (syncDbErr) {
        console.error("Kesalahan jaringan saat sinkronisasi progres ke database utama:", syncDbErr);
      }

      if (showToast) toast.success("Data berhasil disinkronkan!");

    } catch (err: any) {
      console.error("Gagal load progress:", err);
      if (showToast) toast.error("Gagal memuat data progress", { description: err.message });
    } finally {
      setLoadingProgress(false);
    }
  }, [user, userNim]);

  // ===== Initial Load =====
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // ===== Real-time Subscription =====
  useEffect(() => {
    if (!userNim) return;

    const channelProgress = elearningSupabase
      .channel("elearning-student-progress-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_progress",
          filter: `nim=eq.${userNim}`,
        },
        (payload) => {
          console.log("Realtime progress update received:", payload);
          fetchProgress();
          
          if (payload.eventType === "INSERT") {
            toast.success("Progress terupdate!", {
              description: "Materi baru diselesaikan!",
              icon: <Sparkles className="h-4 w-4" />
            });
          }
        }
      )
      .subscribe();

    const channelSession = elearningSupabase
      .channel("elearning-session-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_sessions",
          filter: `nim=eq.${userNim}`,
        },
        () => {
          fetchProgress();
        }
      )
      .subscribe();

    return () => {
      elearningSupabase.removeChannel(channelProgress);
      elearningSupabase.removeChannel(channelSession);
    };
  }, [userNim, fetchProgress]);

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
      const token = await requestJWT(user.id);

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
              Selesaikan pembelajaran mandiri sebelum mengikuti praktikum.
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
          {(() => {
            const levels = (progress?.completed_levels as string[] ?? []);
            const hasCompletedLevel = levels.length > 0;
            return (
              <Card className={`shadow-sm border-0 overflow-hidden relative ${hasCompletedLevel
                ? "bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background"
                : "bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-background"
                }`}>
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 ${hasCompletedLevel ? "bg-green-100/50 dark:bg-green-900/20" : "bg-orange-100/50 dark:bg-orange-900/20"
                  }`} />
                <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status Kurikulum</CardTitle>
                  <div className={`p-2 rounded-lg ${hasCompletedLevel ? "bg-green-100 dark:bg-green-900/50" : "bg-orange-100 dark:bg-orange-900/50"
                    }`}>
                    {hasCompletedLevel
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
                      <div className="flex items-end gap-1 mb-2">
                        <span className={`text-2xl font-bold ${hasCompletedLevel ? "text-green-700 dark:text-green-400" : "text-orange-700 dark:text-orange-400"}`}>
                          {levels.length}
                        </span>
                        <span className={`text-sm font-medium mb-0.5 ${hasCompletedLevel ? "text-green-500/70" : "text-orange-500/70"}`}>
                          level selesai
                        </span>
                      </div>
                      {hasCompletedLevel ? (
                        <div className="flex flex-col gap-1">
                          {levels.map((lvl, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{lvl}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-orange-500" />
                          Selesaikan level untuk unlock absensi.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Level Progress */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-background overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100/50 dark:bg-purple-900/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Level Saat Ini</CardTitle>
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
                  <div className="text-base font-bold text-purple-700 dark:text-purple-400 truncate">
                    {progress?.current_level || "Belum mulai"}
                  </div>
                  {(progress?.completed_levels as string[] ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(progress?.completed_levels as string[] ?? []).map((lvl, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{lvl}
                        </Badge>
                      ))}
                    </div>
                  )}
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
                <span>Pembelajaran <strong>mandiri</strong> wajib diselesaikan sebelum mengikuti praktikum</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>Selesaikan setiap level yang terbuka</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>Jika mengalami kendala, hubungi asisten atau koordinator asisten</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
