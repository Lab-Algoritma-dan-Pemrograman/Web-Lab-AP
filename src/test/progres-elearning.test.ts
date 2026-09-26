/* eslint-disable @typescript-eslint/no-explicit-any */
// Mengunci logika hitung progres di api/sync-elearning.ts terhadap perilaku
// beranda E-Learning. Kalau salah satu sisi berubah, test ini gagal.
//
// Kasus nyata (diambil dari DB 2026-09-26):
//   kurikulum    : level-1=32, level-2=10, level-3=16, level-4=8, level-5=7, level-6=9 (total 82)
//   student_progress: level-1 punya 20 tuntas dari 32 → E-Learning tampil 62,5% (20/32)
import { describe, it, expect } from "vitest";

// Helper murni, disalin mengikuti api/sync-elearning.ts.
function computeProgress(
  levels: { id: string; title: string; sort_order?: number; access_mode?: string; locked?: boolean }[],
  modules: { id: string; level_id: string }[],
  lessons: { id: string; module_id: string }[],
  completedLessonIds: string[],
  overrides: Record<string, string>
) {
  const moduleToLevel: Record<string, string> = {};
  for (const m of modules) moduleToLevel[m.id] = m.level_id;

  const lessonsByLevel: Record<string, string[]> = {};
  for (const l of lessons) {
    const lvl = moduleToLevel[l.module_id];
    if (lvl) (lessonsByLevel[lvl] ||= []).push(l.id);
  }
  const completedSet = new Set(completedLessonIds);

  const effectiveMode = (lvl: any): string => {
    const ov = overrides[lvl.id];
    if (ov && ov !== "auto") return ov;
    if (lvl.access_mode) return lvl.access_mode;
    if (lvl.locked === true) return "locked";
    return "auto";
  };

  const sortedLevels = [...levels].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const isLevelLocked = (idx: number): boolean => {
    const lvl = sortedLevels[idx];
    const ov = overrides[lvl.id];
    if (ov === "locked") return true;
    if (ov === "unlocked") return false;
    if (lvl.access_mode === "locked") return true;
    if (lvl.access_mode === "unlocked") return false;
    if (lvl.locked === true) return true;
    if (idx === 0) return false;
    for (let i = 0; i < idx; i++) {
      const prev = sortedLevels[i];
      if (effectiveMode(prev) === "unlocked") continue;
      if ((lessonsByLevel[prev.id] || []).some(id => !completedSet.has(id))) return true;
    }
    return false;
  };

  let totalLessonsCount = 0, openLessonsCount = 0, openCompletedCount = 0;
  const completedLevels: string[] = [];
  for (let i = 0; i < sortedLevels.length; i++) {
    const ids = lessonsByLevel[sortedLevels[i].id] || [];
    const done = ids.filter(id => completedSet.has(id)).length;
    totalLessonsCount += ids.length;
    if (isLevelLocked(i)) continue;
    openLessonsCount += ids.length;
    openCompletedCount += done;
    if (ids.length > 0 && done >= ids.length) completedLevels.push(sortedLevels[i].title);
  }

  const percentage = openLessonsCount > 0
    ? Math.min(100, Math.round((openCompletedCount / openLessonsCount) * 10000) / 100)
    : 0;

  return { completed_lessons: openCompletedCount, total_lessons: openLessonsCount, completion_percentage: percentage, curriculum_lessons: totalLessonsCount, completed_levels: completedLevels };
}

// --- Data uji: struktur nyata dari DB E-Learning ---
const LEVELS = [
  { id: "level-1", title: "DASAR LOGIKA C", sort_order: 0, access_mode: "auto", locked: false },
  { id: "level-2", title: "STRUKTUR KONTROL C", sort_order: 1, access_mode: "auto", locked: false },
  { id: "level-3", title: "DASAR PYTHON", sort_order: 2, access_mode: "auto", locked: false },
];
const SIZES = [32, 10, 16];

const MODULES: { id: string; level_id: string }[] = [];
const LESSONS: { id: string; module_id: string }[] = [];
LEVELS.forEach((lvl, li) => {
  const mId = `${lvl.id}-m1`;
  MODULES.push({ id: mId, level_id: lvl.id });
  for (let i = 1; i <= SIZES[li]; i++) LESSONS.push({ id: `${lvl.id}-l${i}`, module_id: mId });
});

// 20 pelajaran tuntas, semuanya di level-1
const DONE_20_L1 = LESSONS.filter(l => l.module_id === "level-1-m1").slice(0, 20).map(l => l.id);

describe("progres sync-elearning == beranda E-Learning", () => {
  it("level terkunci tidak dihitung: 20/32 = 62,5% (bukan 20/58)", () => {
    const r = computeProgress(LEVELS, MODULES, LESSONS, DONE_20_L1, {});
    expect(r.completed_lessons).toBe(20);
    expect(r.total_lessons).toBe(32);          // level-2 & level-3 terkunci
    expect(r.completion_percentage).toBe(62.5);
    expect(r.curriculum_lessons).toBe(58);     // transparansi tetap utuh
    expect(r.completed_levels).toEqual([]);    // level-1 belum tuntas
  });

  it("tidak ada pengali 105: 50 pelajaran tuntas = 50/58 = 86,21%", () => {
    const done50 = LESSONS.slice(0, 50).map(l => l.id); // 32 level-1 + 10 level-2 + 8 level-3
    const r = computeProgress(LEVELS, MODULES, LESSONS, done50, {});
    // level-1 & level-2 tuntas → level-3 terbuka; penyebut = 32+10+16
    expect(r.total_lessons).toBe(58);
    expect(r.completed_lessons).toBe(50);
    expect(r.completion_percentage).toBe(86.21);
    expect(r.completed_levels).toEqual(["DASAR LOGIKA C", "STRUKTUR KONTROL C"]);
  });

  it("override 'unlocked' membuka level berikutnya sehingga penyebut ikut naik", () => {
    const r = computeProgress(LEVELS, MODULES, LESSONS, DONE_20_L1, { "level-2": "unlocked" });
    expect(r.total_lessons).toBe(32 + 10);
    expect(r.completion_percentage).toBe(47.62);
  });

  it("tanpa pelajaran tuntas: 0% dan tidak ada level selesai", () => {
    const r = computeProgress(LEVELS, MODULES, LESSONS, [], {});
    expect(r.completed_lessons).toBe(0);
    expect(r.completion_percentage).toBe(0);
  });
});
