// =========================================================================
// Browser Push Notification Utility (Web Notification API)
// Provides native desktop/mobile push notifications for shift assignments
// Stages: H-1, 2 Jam Sebelum, 1 Jam Sebelum, & 30 Menit Sebelum Shift
// =========================================================================

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.warn("Browser ini tidak mendukung Web Notifications API.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
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

export const sendBrowserNotification = (title: string, options: ShiftNotificationOptions) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    const defaultIcon = "/logo.png";
    const notification = new Notification(title, {
      body: options.body,
      icon: options.icon || defaultIcon,
      tag: options.tag || "jadwal-jaga",
      badge: defaultIcon,
      data: options.data,
    });

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
  2. 2 Jam Sebelum Shift (Hari H)
  3. 1 Jam Sebelum Shift (Hari H)
  4. 30 Menit Sebelum Shift (Hari H)
 */
export const checkAndNotifyUpcomingShifts = (user: any, assignments: any[]) => {
  if (!user || !assignments || assignments.length === 0) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Retrieve notified tracking from sessionStorage to avoid duplicate popups
  const getNotifiedList = (key: string): string[] => {
    return JSON.parse(sessionStorage.getItem(key) || "[]");
  };

  const saveNotifiedList = (key: string, list: string[]) => {
    sessionStorage.setItem(key, JSON.stringify(list));
  };

  const keyH1 = `notified_shifts_h1_${user.id}_${todayStr}`;
  const key2h = `notified_shifts_2h_${user.id}_${todayStr}`;
  const key1h = `notified_shifts_1h_${user.id}_${todayStr}`;
  const key30m = `notified_shifts_30m_${user.id}_${todayStr}`;

  const notifiedH1 = getNotifiedList(keyH1);
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
        body: `Besok kamu bertugas sebagai ${taskRole} di ${activityName} ${scheduleInfo}. Siapkan materi ya!`,
        tag: `shift-h1-${assignId}`,
        onClickUrl: "/jadwal-jaga",
      });

      notifiedH1.push(assignId);
      saveNotifiedList(keyH1, notifiedH1);
    }

    // ── Kategori Hari H: Hitung Selisih Menit ─────────────────────────────
    if (assignDateStr === todayStr && assignment.schedule?.start_time) {
      const timeParts = assignment.schedule.start_time.split(":");
      const shiftHours = parseInt(timeParts[0], 10);
      const shiftMinutes = parseInt(timeParts[1], 10);

      const shiftTime = new Date(now);
      shiftTime.setHours(shiftHours, shiftMinutes, 0, 0);

      const diffMs = shiftTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      // ── 2. Pengingat 2 Jam Sebelum Shift (Antara 61 - 120 menit) ────────
      if (diffMinutes <= 120 && diffMinutes > 60 && !notified2h.includes(assignId)) {
        sendBrowserNotification(`⏰ 2 Jam Lagi! Jadwal Jaga`, {
          body: `Halo ${user.full_name || "Asisten"}, 2 jam lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB).`,
          tag: `shift-2h-${assignId}`,
          onClickUrl: "/jadwal-jaga",
        });

        notified2h.push(assignId);
        saveNotifiedList(key2h, notified2h);
      }

      // ── 3. Pengingat 1 Jam Sebelum Shift (Antara 31 - 60 menit) ─────────
      if (diffMinutes <= 60 && diffMinutes > 30 && !notified1h.includes(assignId)) {
        sendBrowserNotification(`⏳ 1 Jam Lagi! Jadwal Jaga`, {
          body: `Persiapkan diri! 1 jam lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB).`,
          tag: `shift-1h-${assignId}`,
          onClickUrl: "/jadwal-jaga",
        });

        notified1h.push(assignId);
        saveNotifiedList(key1h, notified1h);
      }

      // ── 4. Pengingat 30 Menit Sebelum Shift (Antara 0 - 30 menit) ───────
      if (diffMinutes <= 30 && diffMinutes > 0 && !notified30m.includes(assignId)) {
        sendBrowserNotification(`🚨 30 Menit Lagi! Jadwal Jaga Segera Dimulai`, {
          body: `Perhatian! 30 menit lagi kamu bertugas sebagai ${taskRole} di ${activityName} (Pukul ${startTimeStr} WIB). Segera menuju laboratorium!`,
          tag: `shift-30m-${assignId}`,
          onClickUrl: "/jadwal-jaga",
        });

        notified30m.push(assignId);
        saveNotifiedList(key30m, notified30m);
      }
    }
  });
};
