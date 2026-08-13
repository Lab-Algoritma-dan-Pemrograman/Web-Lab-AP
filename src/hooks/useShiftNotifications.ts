import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  checkAndNotifyUpcomingShifts,
  sendBrowserNotification,
} from "@/lib/notifications";

export function useShiftNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || (user.role !== "asisten" && user.role !== "koordinator")) return;

    let isMounted = true;

    const fetchAndCheckShifts = async () => {
      try {
        const { data: assignData } = await supabase.rpc(
          "get_schedule_assignments_secure",
          { p_viewer_id: user.id }
        );

        if (assignData && isMounted) {
          const mapped = assignData.map((a: any) => ({
            ...a,
            schedule: {
              id: a.schedule_id,
              day_of_week: a.schedule_day,
              start_time: a.schedule_start,
              end_time: a.schedule_end,
              title: a.schedule_title,
              major: a.schedule_major,
              class_code: a.schedule_class_code,
            },
            user: { id: a.user_id, full_name: a.user_full_name },
            original_user: {
              id: a.original_user_id,
              full_name: a.original_user_full_name,
            },
          }));

          // Automatically evaluate countdown stages & fire notifications + chime sound
          checkAndNotifyUpcomingShifts(user, mapped);
        }
      } catch (err) {
        console.error("Gagal memeriksa notifikasi jadwal jaga:", err);
      }
    };

    // 1. Initial check when layout loads
    fetchAndCheckShifts();

    // 2. Periodic background check every 30 seconds
    const timer = setInterval(() => {
      fetchAndCheckShifts();
    }, 30000);

    // 3. Supabase Realtime listener for live assignment INSERT and UPDATE events
    const channel = supabase
      .channel("global_jadwal_jaga_notif")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_assignments" },
        (payload: any) => {
          fetchAndCheckShifts();

          if (
            (payload.eventType === "INSERT" || payload.eventType === "UPDATE") &&
            payload.new?.user_id === user.id
          ) {
            const isUpdate = payload.eventType === "UPDATE";
            sendBrowserNotification(
              isUpdate ? "✏️ Perubahan Jadwal Jaga!" : "🚀 Penugasan Jadwal Jaga Baru!",
              {
                body: `Jadwal jaga kamu sebagai ${payload.new.task_role || "Petugas"} untuk ${payload.new.activity_name || "Praktikum"} telah ${isUpdate ? "diperbarui" : "ditambahkan"}.`,
                onClickUrl: "/jadwal-jaga",
              }
            );
          } else if (payload.new?.status === "mencari_pengganti" && payload.new?.user_id !== user.id) {
            sendBrowserNotification("🔄 Permintaan Tukar Jadwal Jaga!", {
              body: `Ada asisten yang sedang mencari pengganti jadwal jaga. Klik untuk melihat & membantu.`,
              onClickUrl: "/jadwal-jaga",
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);
}
