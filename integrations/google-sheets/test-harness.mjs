/**
 * Harness uji logika syncAbsensi (Code.gs) tanpa Google Apps Script.
 * Jalankan: node integrations/google-sheets/test-harness.mjs [path-ke-xlsx]
 *
 * Path spreadsheet bisa juga lewat env SHEET_XLSX. Kalau file tidak ada,
 * harness memakai grid sintetis (layout sama) supaya tetap bisa dijalankan.
 *
 * Yang diuji: pemetaan NIM→baris, judul sesi QR→kolom, absen manual tanpa
 * session_id (cocok tanggal), penjagaan kolom Pengarahan, dan mode dry-run.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODE_PATH = path.join(HERE, 'Code.gs');
const XLSX_PATH = process.argv[2] || process.env.SHEET_XLSX ||
  'C:/Users/MyBook Hype AMD/AppData/Local/hermes/attachments/Penilaian Praktikum.xlsx';

/* --------------------------- fake spreadsheet ---------------------------- */
function sheetFromAoa(name, aoa, cols) {
  const grid = aoa.map((r) => r.slice());
  const width = cols || Math.max(...grid.map((r) => r.length), 12);
  grid.forEach((r) => { while (r.length < width) r.push(null); });
  return {
    _name: name, _grid: grid,
    getName() { return this._name; },
    getLastRow() {
      for (let i = this._grid.length - 1; i >= 0; i--) {
        if (this._grid[i].some((c) => c !== null && c !== '')) return i + 1;
      }
      return 0;
    },
    getLastColumn() { return width; },
    getRange(row, col, numRows = 1, numCols = 1) {
      const g = this._grid;
      return {
        getValues() {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const src = g[row - 1 + r] || [];
            const line = [];
            for (let c = 0; c < numCols; c++) line.push(src[col - 1 + c] === undefined ? null : src[col - 1 + c]);
            out.push(line);
          }
          return out;
        },
        setValues(values) {
          for (let r = 0; r < values.length; r++) {
            for (let c = 0; c < values[r].length; c++) {
              const rr = row - 1 + r, cc = col - 1 + c;
              while (g.length <= rr) g.push([]);
              while (g[rr].length <= cc) g[rr].push(null);
              g[rr][cc] = values[r][c];
            }
          }
        },
      };
    },
  };
}

/* ------------------------------- fake data ------------------------------- */
function syntheticSheets() {
  const header1 = ['No', 'NIM', 'NAMA', 'Asisten', 'Kehadiran (10%)'];
  const header2 = [null, null, null, null, 'Pengarahan', 1, 2, '3&4', 5, 6, 'Ujian Praktik', 'Total'];
  const names = ['TL A', 'TE A', 'TE B', 'TE C', 'TE D', 'TE E', 'TSE A', 'TSE B', 'TSE C'];
  const prefixNim = { 'TL A': 202671, 'TE A': 202611, 'TE B': 202512, 'TE C': 202613, 'TE D': 202614, 'TE E': 202616, 'TSE A': 202621, 'TSE B': 202622, 'TSE C': 202623 };
  return names.map((n) => {
    const aoa = [header1, header2];
    for (let i = 1; i <= 8; i++) {
      const nim = prefixNim[n] * 1000 + i;
      aoa.push([i, nim, 'SISWA ' + n + ' ' + i, null,
        false, false, false, false, false, false, false, 0]);
    }
    return sheetFromAoa(n, aoa);
  });
}

const useReal = fs.existsSync(XLSX_PATH);
const sheets = useReal
  ? XLSX.readFile(XLSX_PATH).SheetNames.map((n) =>
      sheetFromAoa(n, XLSX.utils.sheet_to_json(XLSX.readFile(XLSX_PATH).Sheets[n], { header: 1, raw: true, defval: null })))
  : syntheticSheets();
console.log(useReal ? `layout dari: ${XLSX_PATH}` : `layout asli tidak ditemukan — pakai grid sintetis`);

const sheetByName = Object.fromEntries(sheets.map((s) => [s.getName(), s]));

// user DB: semua NIM di sheet TE A → jurusan 'Teknik Elektro' kelas A
const teA = sheetByName['TE A'];
const teANims = [];
for (let r = 3; r <= teA.getLastRow(); r++) {
  const v = teA._grid[r - 1][1];
  if (v !== null && v !== '') teANims.push(String(v));
}
const users = teANims.map((nim, i) => ({
  id: 1000 + i, username: nim, full_name: 'SISWA ' + nim,
  major: 'Teknik Elektro', class_code: 'A',
}));
const idByNim = Object.fromEntries(users.map((u) => [u.username, u.id]));

const S = (id, title) => ({ id, title });
const sessions = [
  S('11111111-1111-1111-1111-111111111111', 'Pengarahan - S1 Teknik Elektro A'),
  S('22222222-2222-2222-2222-222222222222', 'Modul 1 - S1 Teknik Elektro A'),
  S('33333333-3333-3333-3333-333333333333', 'Modul 2 - S1 Teknik Elektro A'),
  S('44444444-4444-4444-4444-444444444444', 'Modul 3 - S1 Teknik Elektro A'),
  S('55555555-5555-5555-5555-555555555555', 'Modul 4&5 - S1 Teknik Elektro A'),
  S('66666666-6666-6666-6666-666666666666', 'Presentasi - S1 Teknik Elektro A'),
];
const dayOf = { pengarahan: '2026-09-05', m1: '2026-09-12', m2: '2026-09-19', m3: '2026-09-26', m4: '2026-10-03', m6: '2026-10-10' };
const T = (d) => `${d}T01:00:00+00:00`; // 08:00 WIB

const logs = [];
let logId = 1;
const add = (nim, sessionId, dateStr, status = 'Hadir', type = 'scan', meeting = null) => logs.push({
  id: logId++, custom_user_id: idByNim[nim], status, check_in_time: T(dateStr),
  session_id: sessionId, type, meeting,
});

// siswa 1: hadir pengarahan + modul 1,2,3,4&5
add(teANims[0], sessions[0].id, dayOf.pengarahan);
['m1', 'm2', 'm3', 'm4'].forEach((k, i) => add(teANims[0], sessions[i + 1].id, dayOf[k]));
// siswa 2: hanya modul 1
add(teANims[1], sessions[1].id, dayOf.m1);
// siswa 3: absen MANUAL (tanpa session_id) tanggal yang sama dengan sesi Modul 2
add(teANims[2], null, dayOf.m2, 'Hadir', 'staff_manual');
// siswa 4: izin tanpa sesi → tidak boleh muncul centang
add(teANims[3], null, dayOf.m2, 'Izin', 'izin');
// siswa 5: hadir dengan alias judul "Praktikum Modul 1"
add(teANims[4], 'alias-session', dayOf.m3, 'Hadir', 'scan');
sessions.push(S('alias-session', 'Praktikum Modul 1 - Teknik Elektro A'));
// siswa 6: judul sesi tak dikenal → harus dilaporkan, tidak dicentang
add(teANims[5], 'weird-session', dayOf.m4, 'Hadir', 'scan');
sessions.push(S('weird-session', 'Kelas Pengganti - S1 Teknik Elektro A'));

// siswa 7: absen manual DENGAN dropdown Pertemuan (kolom `meeting`) di hari
// tanpa sesi QR sama sekali → harus tetap masuk kolom 5.0
add(teANims[7], null, '2026-10-17', 'Hadir', 'staff_manual', 'Modul 5');
// siswa 7: `meeting` harus menang atas kecocokan tanggal/sesi QR
add(teANims[7], sessions[3].id, dayOf.m3, 'Hadir', 'scan', 'Ujian Praktik');

/* ------------------------------- GAS stubs ------------------------------- */
const props = {
  SUPABASE_URL: 'https://stub.supabase.co',
  SUPABASE_SERVICE_KEY: 'stub-key',
  SYNC_FROM: '2026-09-01',
};
const calls = [];
const context = {
  console,
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: () => {} }) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }) },
  ContentService: { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'json' } },
  Utilities: {
    formatDate(d, tz, fmt) {
      const p = (n) => String(n).padStart(2, '0');
      const z = new Date(d.getTime() + 7 * 3600 * 1000);
      if (fmt === 'yyyy-MM-dd') return `${z.getUTCFullYear()}-${p(z.getUTCMonth() + 1)}-${p(z.getUTCDate())}`;
      return `${z.getUTCFullYear()}-${p(z.getUTCMonth() + 1)}-${p(z.getUTCDate())} ${p(z.getUTCHours())}:${p(z.getUTCMinutes())}`;
    },
  },
  UrlFetchApp: {
    fetch(url) {
      calls.push(url);
      const table = url.match(/\/rest\/v1\/([a-z_]+)/)[1];
      const data = table === 'users' ? users : table === 'attendance_logs' ? logs : sessions;
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(data) };
    },
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({ getSheets: () => sheets }),
    getUi: () => ({ alert: () => {} }),
  },
};

/* --------------------------------- jalan --------------------------------- */
const code = fs.readFileSync(CODE_PATH, 'utf8');
vm.createContext(context);
new vm.Script(code, { filename: 'Code.gs' }).runInContext(context);

const report = context.syncAbsensi(false);
console.log('=== LAPORAN ===');
console.log(report);

/* -------------------------------- asserts -------------------------------- */
const at = (sheet, row, col) => {
  const line = sheet._grid[row - 1];
  return line ? line[col - 1] : undefined;
};
const C = { Pengarahan: 5, m1: 6, m2: 7, m34: 8, m5: 9, m6: 10, ujian: 11 };
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const rowOf = (nim) => users.find((u) => u.username === nim) && (teANims.indexOf(nim) + 3);

check('siswa1 modul1', at(teA, rowOf(teANims[0]), C.m1), true);
check('siswa1 modul2', at(teA, rowOf(teANims[0]), C.m2), true);
check('siswa1 3&4', at(teA, rowOf(teANims[0]), C.m34), true);
check('siswa1 5.0', at(teA, rowOf(teANims[0]), C.m5), true);
check('siswa1 6.0 kosong', at(teA, rowOf(teANims[0]), C.m6), false);
check('siswa1 ujian kosong', at(teA, rowOf(teANims[0]), C.ujian), false);
check('siswa2 hanya modul1', at(teA, rowOf(teANims[1]), C.m1), true);
check('siswa2 modul2 kosong', at(teA, rowOf(teANims[1]), C.m2), false);
check('siswa3 manual ikut modul2', at(teA, rowOf(teANims[2]), C.m2), true);
check('siswa4 izin tidak dicentang', at(teA, rowOf(teANims[3]), C.m2), false);
check('siswa5 alias "Praktikum Modul 1"', at(teA, rowOf(teANims[4]), C.m1), true);
check('siswa6 judul tak dikenal', at(teA, rowOf(teANims[5]), C.m34), false);
check('pengarahan siswa3 tetap apa adanya', at(teA, rowOf(teANims[2]), C.Pengarahan), false);
check('NIM lain tidak ikut kena', at(teA, rowOf(teANims[6]), C.m1) !== true, true);

// kolom `meeting` (dropdown Pertemuan di halaman Absensi)
check('siswa7 manual "Modul 5" tanpa sesi QR → kolom 5.0', at(teA, rowOf(teANims[7]), C.m5), true);
check('siswa7 "Ujian Praktik" menang atas kecocokan tanggal → kolom Ujian', at(teA, rowOf(teANims[7]), C.ujian), true);
check('siswa7 tidak nyasar ke kolom 3&4', at(teA, rowOf(teANims[7]), C.m34) !== true, true);
check('laporan menyebut asal kolom', /Sumber kolom:/.test(report), true);

// dry-run harus nol perubahan
const before = JSON.stringify(teA._grid);
context.syncAbsensi(true);
check('dry-run tidak menulis apa pun', JSON.stringify(teA._grid) === before, true);

console.log(`\n=== ${fails === 0 ? 'SEMUA PASS' : fails + ' GAGAL'} ===`);
process.exit(fails === 0 ? 0 : 1);
