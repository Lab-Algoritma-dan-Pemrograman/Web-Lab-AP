// =========================================================================
// Browser Push Notification Utility (Web Notification API + Service Worker + VAPID Keys + Web Audio)
// Provides native desktop/mobile push notifications + audio chime sound + Daily Quotes
// Stages: H-1, Hari Ini, 2 Jam Sebelum, 1 Jam Sebelum, & 30 Menit Sebelum Shift
// =========================================================================

import { toast } from "sonner";
import { getDailyQuote } from "./quotes";
import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BIrsvU55B5AXjGVqi1kVqKgINewqYRiIFE5wDBAapS17GQiA8Xx5hphZ40Q4d-u83wt5zGYzjzqQuzbufcz7XuU";

export const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Auto Register Service Worker for PWA Push Notifications
export const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      console.log("PWA Service Worker registered successfully:", reg.scope);
      return reg;
    } catch (err) {
      console.warn("Gagal mendaftarkan Service Worker:", err);
    }
  }
  return null;
};

/**
  Subscribes current browser device to VAPID Web Push and saves token to DB
 */
export const subscribeToWebPush = async (user: any) => {
  if (!user || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = sub.toJSON();
    if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
      const { error } = await supabase.rpc("save_push_subscription_secure", {
        p_caller_id: Number(user.id),
        p_endpoint: subJson.endpoint,
        p_p256dh: subJson.keys.p256dh,
        p_auth: subJson.keys.auth,
        p_user_agent: navigator.userAgent,
      });

      if (error) {
        console.warn("RPC save_push_subscription_secure warning, trying fallback upsert:", error.message);
        await supabase.from("push_subscriptions").upsert({
          user_id: Number(user.id),
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });
      }

      console.log("VAPID Web Push subscription saved successfully for user:", user.id);
    }
  } catch (err) {
    console.error("Gagal berlangganan VAPID Web Push:", err);
  }
};

/**
  Unsubscribes device token from Web Push and removes it from database on logout
 */
export const unsubscribeWebPush = async (user?: any) => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
        console.log("VAPID Push subscription removed on logout");
      }
    }
  } catch (err) {
    console.error("Gagal menghapus push subscription saat logout:", err);
  }
};

export const requestNotificationPermission = async (user?: any): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung Web Notifications API.");
    return false;
  }

  await registerServiceWorker();

  let isGranted = Notification.permission === "granted";

  if (!isGranted && Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    isGranted = permission === "granted";
  }

  if (isGranted && user) {
    await subscribeToWebPush(user);
  }

  return isGranted;
};

export const getNotificationPermissionState = (): NotificationPermission | "unsupported" => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
};

export interface ShiftNotificationOptions {
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  onClickUrl?: string;
}

export const formatLocalDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
  Clears notification tracking history in sessionStorage so updated/re-edited shifts can re-notify
 */
export const clearShiftNotifiedHistory = (assignmentId?: string | number) => {
  try {
    if (assignmentId) {
      const idStr = assignmentId.toString();
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("notified_shifts_")) {
          const list: string[] = JSON.parse(sessionStorage.getItem(key) || "[]");
          const filtered = list.filter((item) => item !== idStr);
          sessionStorage.setItem(key, JSON.stringify(filtered));
        }
      });
    } else {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("notified_shifts_")) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (e) {
    console.error("Gagal menghapus riwayat notifikasi:", e);
  }
};

/**
  Plays a crisp, pleasant 2-tone notification sound (Web Audio API)
 */
export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1: 880Hz (A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Tone 2: 1320Hz (E6) - 0.1s delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, now + 0.1);
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Suppress audio autoplay errors
  }
};

export const sendBrowserNotification = async (title: string, options: ShiftNotificationOptions) => {
  // 1. Play audio chime sound
  playNotificationSound();

  // 2. Trigger toast as in-app fallback notification banner with rich details
  toast.info(title, {
    description: options.body,
    duration: 8000,
  });

  // 3. Trigger native browser / OS Service Worker push notification with full WhatsApp-style text & banner
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    const defaultIcon = "/logo.png";
    const notificationOptions: NotificationOptions & { [key: string]: any } = {
      body: options.body,
      icon: options.icon || defaultIcon,
      tag: options.tag || `jadwal-jaga-${Date.now()}`,
      badge: defaultIcon,
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true, // Stays on screen like WhatsApp notification until user interacts
      renotify: true,
      data: { url: options.onClickUrl || "/jadwal-jaga" },
    };

    // Use Service Worker if active for persistent OS level notification
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    }

    // Fallback to standard window Notification
    const notification = new Notification(title, notificationOptions);
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.onClickUrl) {
        window.location.href = options.onClickUrl;
      }
      notification.close();
    };
  } catch (err) {
    console.error("Gagal mengirim notifikasi browser:", err);
  }
};

/**
  Checks upcoming shifts for the logged-in user:
  1. H-1 (Diberitahukan sehari sebelumnya)
  2. Hari Ini (Saat pertama kali membuka web pada tanggal bertugas)
  3. 2 Jam Sebelum Shift (Hari H)
  4. 1 Jam Sebelum Shift (Hari H)
  5. 30 Menit Sebelum Shift (Hari H)
 */
export const checkAndNotifyUpcomingShifts = (user: any, assignments: any[]) => {
  if (!user || !assignments || assignments.length === 0) return;

  const now = new Date();
  const todayStr = formatLocalDateStr(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = formatLocalDateStr(tomorrow);

  const userRole = user.role || "asisten";
  const quote = getDailyQuote(userRole);

  const getNotifiedList = (key: string): string[] => {
    return JSON.parse(sessionStorage.getItem(key) || "[]");
  };

  const saveNotifiedList = (key: string, list: string[]) => {
    sessionStorage.setItem(key, JSON.stringify(list));
  };

  const keyH1 = `notified_shifts_h1_${user.id}_${todayStr}`;
  const keyTodayGeneral = `notified_shifts_today_general_${user.id}_${todayStr}`;
  const key2h = `notified_shifts_2h_${user.id}_${todayStr}`;
  const key1h = `notified_shifts_1h_${user.id}_${todayStr}`;
  const key30m = `notified_shifts_30m_${user.id}_${todayStr}`;

  const notifiedH1 = getNotifiedList(keyH1);
  const notifiedGeneral = getNotifiedList(keyTodayGeneral);
  const notified2h = getNotifiedList(key2h);
  const notified1h = getNotifiedList(key1h);
  const notified30m = getNotifiedList(key30m);

  // Filter shifts assigned to current logged-in assistant
  const myAssignments = assignments.filter((a) => a.user?.id === user.id || a.user_id === user.id);

  myAssignments.forEach((assignment) => {
    if (!assignment.activity_date) return;
    const assignDateStr = assignment.activity_date.split("T")[0];
    const assignId = assignment.id.toString();

    const taskRole = assignment.task_role || "Petugas Jaga";
    const activityName = assignment.activity_name || "Praktikum";
    const startTimeStr = assignment.schedule?.start_time?.slice(0, 5) || "00:00";
    const scheduleInfo = `(Jam ${startTimeStr} WIB - ${assignment.schedule?.major || ""} ${assignment.schedule?.class_code || ""})`;

    // ── 1. Pengingat H-1 (Besok Ada Shift) ──────────────────────────────────
    if (assignDateStr === tomorrowStr && !notifiedH1.includes(assignId)) {
      sendBrowserNotification(`⏰ Pengingat H-1 Jadwal Jaga`, {
        body: `Besok kamu bertugas sebagai ${taskRole} di ${activityName} ${scheduleInfo}. Siapkan materi ya!\n\n✨ "${quote}"`,
        tag: `shift-h1-${assignId}`,
        onClickUrl: "/jadwal-jaga",
      });

      notifiedH1.push(assignId);
      saveNotifiedList(keyH1, notifiedH1);
    }

    // ── Kategori Hari H ───────────────────────────────────────────────────
    if (assignDateStr === todayStr) {
      // ── 2. General Hari Ini Reminder ────────────────────────────────────
      if (!notifiedGeneral.includes(assignId)) {
        sendBrowserNotification(`📌 Jadwal Jaga Hari Ini!`, {
          body: `Halo ${user.full_name || "Asisten"}, hari ini kamu bertugas sebagai ${taskRole} di ${activityName} ${scheduleInfo}.\n\n✨ "${quote}"`,
          tag: `shift-today-gen-${assignId}`,
          onClickUrl: "/jadwal-jaga",
        });

        notifiedGeneral.push(assignId);
        saveNotifiedList(keyTodayGeneral, notifiedGeneral);
      }

      // Hitung Selisih Menit untuk Countdown (2 Jam, 1 Jam, 30 Menit)
      if (assignment.schedule?.start_time) {
        const timeParts = assignment.schedule.start_time.split(":");
        const shiftHours = parseInt(timeParts[0], 10);
        const shiftMinutes = parseInt(timeParts[1], 10);

        const shiftTime = new Date(now);
        shiftTime.setHours(shiftHours, shiftMinutes, 0, 0);

        const diffMs = shiftTime.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        // ── 3. Pengingat 2 Jam Sebelum Shift (Antara 61 - 120 menit) ────────
        if (diffMinutes <= 120 && diffMinutes > 60 && !notified2h.includes(assignId)) {
          sendBrowserNotification(`⏰ 2 Jam Lagi! Jadwal Jaga`, {
            body: `Halo ${user.full_name || "Asisten"}, 2 jam lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB).\n\n✨ "${quote}"`,
            tag: `shift-2h-${assignId}`,
            onClickUrl: "/jadwal-jaga",
          });

          notified2h.push(assignId);
          saveNotifiedList(key2h, notified2h);
        }

        // ── 4. Pengingat 1 Jam Sebelum Shift (Antara 31 - 60 menit) ─────────
        if (diffMinutes <= 60 && diffMinutes > 30 && !notified1h.includes(assignId)) {
          sendBrowserNotification(`⏳ 1 Jam Lagi! Jadwal Jaga`, {
            body: `Persiapkan diri! 1 jam lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB).\n\n✨ "${quote}"`,
            tag: `shift-1h-${assignId}`,
            onClickUrl: "/jadwal-jaga",
          });

          notified1h.push(assignId);
          saveNotifiedList(key1h, notified1h);
        }

        // ── 5. Pengingat 30 Menit Sebelum Shift (Antara 0 - 30 menit) ───────
        if (diffMinutes <= 30 && diffMinutes > 0 && !notified30m.includes(assignId)) {
          sendBrowserNotification(`🚨 30 Menit Lagi! Jadwal Jaga Segera Dimulai`, {
            body: `Perhatian! 30 menit lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB). Segera menuju laboratorium!\n\n✨ "${quote}"`,
            tag: `shift-30m-${assignId}`,
            onClickUrl: "/jadwal-jaga",
          });

          notified30m.push(assignId);
          saveNotifiedList(key30m, notified30m);
        }
      }
    }
  });
};
