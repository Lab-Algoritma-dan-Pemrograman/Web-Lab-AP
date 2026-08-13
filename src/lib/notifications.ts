// =========================================================================
// Browser Push Notification Utility (Web Notification API)
// Provides native desktop/mobile push notifications for shift assignments
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
  Checks upcoming shifts for the logged-in user (Today & H-1)
  and triggers browser push notifications if not already notified.
 */
export const checkAndNotifyUpcomingShifts = (user: any, assignments: any[]) => {
  if (!user || !assignments || assignments.length === 0) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Retrieve notified assignment IDs from sessionStorage to prevent spamming on page refresh
  const notifiedTodayKey = `notified_shifts_today_${user.id}_${todayStr}`;
  const notifiedTomorrowKey = `notified_shifts_tomorrow_${user.id}_${todayStr}`;

  const notifiedToday: string[] = JSON.parse(sessionStorage.getItem(notifiedTodayKey) || "[]");
  const notifiedTomorrow: string[] = JSON.parse(sessionStorage.getItem(notifiedTomorrowKey) || "[]");

  // Filter shifts assigned to current logged-in assistant
  const myAssignments = assignments.filter((a) => a.user?.id === user.id || a.user_id === user.id);

  myAssignments.forEach((assignment) => {
    if (!assignment.activity_date) return;
    const assignDateStr = assignment.activity_date.split("T")[0];

    const assignId = assignment.id.toString();
    const taskRole = assignment.task_role || "Petugas Jaga";
    const activityName = assignment.activity_name || "Praktikum";
    const scheduleInfo = assignment.schedule
      ? `(${assignment.schedule.day_of_week}, ${assignment.schedule.start_time?.slice(0, 5)} WIB)`
      : "";

    // 1. Shift Hari Ini
    if (assignDateStr === todayStr && !notifiedToday.includes(assignId)) {
      sendBrowserNotification(`📌 Jadwal Jaga Hari Ini!`, {
        body: `Halo ${user.full_name || "Asisten"}, hari ini kamu bertugas sebagai ${taskRole} di ${activityName} ${scheduleInfo}.`,
        tag: `shift-today-${assignId}`,
        onClickUrl: "/jadwal-jaga",
      });

      notifiedToday.push(assignId);
      sessionStorage.setItem(notifiedTodayKey, JSON.stringify(notifiedToday));
    }

    // 2. Shift H-1 (Besok)
    if (assignDateStr === tomorrowStr && !notifiedTomorrow.includes(assignId)) {
      sendBrowserNotification(`⏰ Pengingat H-1 Jadwal Jaga`, {
        body: `Besok kamu bertugas sebagai ${taskRole} di ${activityName} ${scheduleInfo}. Siapkan materi ya!`,
        tag: `shift-tomorrow-${assignId}`,
        onClickUrl: "/jadwal-jaga",
      });

      notifiedTomorrow.push(assignId);
      sessionStorage.setItem(notifiedTomorrowKey, JSON.stringify(notifiedTomorrow));
    }
  });
};
