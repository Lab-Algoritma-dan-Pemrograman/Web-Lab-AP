/**
 * ============================================================================
 *  Web Lab AP — Sinkronisasi Absensi Supabase  →  Spreadsheet Penilaian
 * ============================================================================
 *  Dipasang sebagai Apps Script BOUND (Extensions → Apps Script) di dalam
 *  spreadsheet "Penilaian Praktikum".
 *
 *  Sumber  : Supabase  (tabel users, attendance_logs, qr_sessions)
 *  Tujuan  : kolom Kehadiran (10%) tiap sheet kelas — E..K
 *            Pengarahan | 1.0 | 2.0 | 3&4 | 5.0 | 6.0 | Ujian Praktik
 *
 *  Aturan  : TRUE  = Hadir
 *            kolom "Pengarahan" TIDAK disentuh (default) — atur lewat properti
 *            OVERWRITE_FALSE untuk ikut mem-FALSE-kan checkbox yang kosong.
 *
 *  Pemasangan lengkap: lihat SETUP.md di folder yang sama.
 * ============================================================================
 */

/* ------------------------------- KONFIGURASI ------------------------------ */

/** Urutan kolom kehadiran yang dikelola (setelah Pengarahan). */
var MEETING_COLUMNS = ['1.0', '2.0', '3&4', '5.0', '6.0', 'Ujian Praktik'];

/** Label kolom Pengarahan (boleh diabaikan, lihat properti SYNC_PENGARAHAN). */
var PENGARAHAN_LABEL = 'Pengarahan';

/**
 * Pemetaan judul sesi QR (qr_sessions.title) → indeks kolom MEETING_COLUMNS.
 * Judul sesi dibuat di halaman "Buat QR" dengan format:
 *     "<Jenis Pertemuan> - <Jurusan> <Kelas>"     contoh: "Modul 1 - S1 Teknik Elektro A"
 *
 * Catatan: daftar di BuatQR memakai "Modul 3&4" lalu "Modul 5", sedangkan
 * kolom spreadsheet memakai "3&4" lalu "5.0". Karena keduanya sama-sama
 * berjumlah 6 pertemuan dengan urutan yang sama, pemetaan di bawah ini
 * bersifat POSISIONAL: pertemuan ke-n → kolom ke-n.
 * Ubah di sini kalau penamaan pertemuan berubah.
 */
var MEETING_KEY_TO_INDEX = {
  'modul 1': 0,
  'praktikum modul 1': 0,
  'modul 2': 1,
  'praktikum modul 2': 1,
  'modul 3': 2,
  'praktikum modul 3': 2,
  'modul 3&4': 2,
  'modul 3 dan 4': 2,
  'modul 4&5': 3,
  'modul 4 dan 5': 3,
  'modul 4': 3,
  'modul 5': 3,
  'praktikum modul 5': 3,
  'modul 6': 4,
  'praktikum modul 6': 4,
  'ujian praktik': 5,
  'ujian': 5,
  'presentasi': 5,
};

/** Status di DB yang dianggap hadir. */
var PRESENT_STATUSES = ['Hadir', 'hadir', 'HADIR'];

/** Prefiks sheet per jurusan (urutan penting: yang lebih spesifik dulu). */
var MAJOR_PREFIX = [
  [/sistem\s*energi/i, 'TSE'],
  [/teknologi\s*listrik/i, 'TL'],
  [/tenaga\s*listrik/i, 'TL'],
  [/elektro/i, 'TE'],
];

/* --------------------------- PROPERti & PENGATURAN ------------------------ */

function props_() {
  return PropertiesService.getScriptProperties();
}

function cfg_() {
  var p = props_();
  return {
    url: (p.getProperty('SUPABASE_URL') || '').trim(),
    key: (p.getProperty('SUPABASE_SERVICE_KEY') || '').trim(),
    syncFrom: (p.getProperty('SYNC_FROM') || '2026-09-01').trim(),
    syncPengarahan: p.getProperty('SYNC_PENGARAHAN') === 'true',
    overwriteFalse: p.getProperty('OVERWRITE_FALSE') === 'true',
    timezone: (p.getProperty('TIMEZONE') || 'Asia/Jakarta').trim(),
  };
}

/* -------------------------------- MENU UI -------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Web Lab AP')
    .addItem('🔄 Sync absensi sekarang', 'menuSyncNow')
    .addItem('🧪 Simulasi (tidak menulis)', 'menuDryRun')
    .addSeparator()
    .addItem('🔑 Set kredensial Supabase', 'menuSetCredentials')
    .addItem('⏱️ Pasang / perbarui trigger otomatis', 'menuInstallTrigger')
    .addItem('ℹ️ Status konfigurasi', 'menuStatus')
    .addToUi();
}

function menuSyncNow() {
  alert_('Selesai.\n\n' + syncAbsensi(false));
}

function menuDryRun() {
  alert_('Simulasi (tidak ada perubahan ditulis).\n\n' + syncAbsensi(true));
}

/**
 * Dipanggil dari editor Apps Script (dropdown fungsi → Run).
 * Simulasi: aman, tidak menulis apa pun. Laporan masuk Execution log.
 */
function testSimulasi() {
  var report = syncAbsensi(true);
  Logger.log(report);
  alert_(report);
}

/** Sinkronisasi sungguhan, dipanggil dari editor. Laporan masuk Execution log. */
function syncSekarang() {
  var report = syncAbsensi(false);
  Logger.log(report);
  alert_(report);
}

function menuSetCredentials() {
  var ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (err) {
    throw new Error('Skrip mandiri tidak punya menu. Isi manual di Project Settings → ' +
      'Script properties: SUPABASE_URL, SUPABASE_SERVICE_KEY, SHEET_ID.');
  }
  var p = props_();

  var urlRes = ui.prompt('Supabase URL', 'Contoh: https://xxxxxxxxxxxx.supabase.co',
    ui.ButtonSet.OK_CANCEL);
  if (urlRes.getSelectedButton() !== ui.Button.OK) return;
  var url = urlRes.getResponseText().trim();
  if (!url) { ui.alert('URL kosong — dibatalkan.'); return; }

  var keyRes = ui.prompt('Supabase service_role key',
    'Ambil di Supabase → Project Settings → API → service_role (secret).\n' +
    'Key ini disimpan di Script Properties spreadsheet ini, tidak ikut terunduh.',
    ui.ButtonSet.OK_CANCEL);
  if (keyRes.getSelectedButton() !== ui.Button.OK) return;
  var key = keyRes.getResponseText().trim();
  if (!key) { ui.alert('Key kosong — dibatalkan.'); return; }

  p.setProperty('SUPABASE_URL', url);
  p.setProperty('SUPABASE_SERVICE_KEY', key);
  ui.alert('Kredensial tersimpan. Jalan-kan "Simulasi" dulu untuk mengetes koneksi.');
}

function menuInstallTrigger() {
  alert_(installTrigger(10));
}

/**
 * Diagnosa kredensial: memastikan URL & key masuk ke properti yang benar.
 * Hanya melaporkan bentuk key (panjang, prefix, role & project di dalam JWT) —
 * TIDAK pernah menampilkan key utuh.
 */
function diagnosaKredensial() {
  var p = props_();
  var url = p.getProperty('SUPABASE_URL') || '';
  var key = p.getProperty('SUPABASE_SERVICE_KEY') || '';
  var out = [];

  out.push('URL        : ' + JSON.stringify(url));
  if (!key) {
    out.push('KEY        : (kosong) — properti SUPABASE_SERVICE_KEY belum diisi.');
  } else {
    out.push('KEY        : panjang=' + key.length + ', awal="' + key.slice(0, 3) + '…"');
    if (/\s/.test(key)) {
      out.push('           ⚠ ada spasi/enter di dalam key — hapus, tempel ulang tanpa baris baru.');
    }
    if (/^Bearer\s/i.test(key)) {
      out.push('           ⚠ masih ada awalan "Bearer " — buang, cukup key-nya saja.');
    }
  }

  var seg = key.indexOf('eyJ') === 0 ? key.split('.')[1] : null;
  if (seg) {
    try {
      var b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString());
      out.push('JWT role   : ' + payload.role + (payload.role === 'service_role'
        ? '  ✓ boleh baca semua data'
        : '  ✗ BUKAN service_role — RLS akan menolak'));
      out.push('JWT ref    : ' + payload.ref);
      var urlRef = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
      if (urlRef) {
        out.push('Ref di URL : ' + urlRef + (urlRef === payload.ref
          ? '  ✓ cocok'
          : '  ✗ BEDA PROJECT — key dan URL dari project berbeda'));
      }
      if (payload.exp) {
        out.push('JWT exp    : ' + new Date(payload.exp * 1000).toISOString());
      }
    } catch (err) {
      out.push('JWT payload tidak terbaca: ' + err.message);
    }
  } else if (key.indexOf('sb_secret_') === 0) {
    out.push('Format key : sb_secret_ (service role format baru) ✓');
  } else if (key.indexOf('sb_publishable_') === 0) {
    out.push('Format key : sb_publishable_ → ini kunci PUBLIK, bukan service_role ✗');
  } else if (key) {
    out.push('Format key : tidak dikenal (bukan JWT, bukan sb_secret_, bukan sb_publishable_)');
  }

  out.push('', 'Sheet      : ' + (function () {
    try { return getSpreadsheet_().getName(); } catch (e) { return '(' + e.message + ')'; }
  })());

  var text = out.join('\n');
  Logger.log(text);
  alert_(text);
}

function menuStatus() {
  var c = cfg_();
  var status = [
    'SUPABASE_URL      : ' + (c.url ? c.url : '(belum diisi)'),
    'SUPABASE_KEY      : ' + (c.key ? 'tersimpan (' + c.key.length + ' karakter)' : '(belum diisi)'),
    'SYNC_FROM         : ' + c.syncFrom,
    'SYNC_PENGARAHAN   : ' + c.syncPengarahan,
    'OVERWRITE_FALSE   : ' + c.overwriteFalse,
    'TIMEZONE          : ' + c.timezone,
    '',
    'Sheet terdeteksi  : ' + getSpreadsheet_().getSheets()
      .map(function (s) { return s.getName(); }).join(', ')
  ].join('\n');
  alert_(status);
}

function installTrigger(minutes) {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncAbsensiTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  ScriptApp.newTrigger('syncAbsensiTrigger')
    .timeBased()
    .everyMinutes(minutes || 10)
    .create();
  return 'Trigger otomatis tiap ' + (minutes || 10) + ' menit terpasang' +
    (removed ? ' (mengganti ' + removed + ' trigger lama).' : '.');
}

/** Handler trigger (dipisah agar bisa dipasang/dihapus tanpa mengganggu menu). */
function syncAbsensiTrigger() {
  syncAbsensi(false);
}

/**
 * Opsional: endpoint webhook (Supabase → Database Webhooks).
 * URL webhook: https://script.google.com/macros/s/XXXX/exec?secret=<WEBHOOK_SECRET>
 * Diberi throttle 20 detik karena satu sesi QR bisa memicu puluhan insert beruntun.
 */
function doPost(e) {
  try {
    var secret = props_().getProperty('WEBHOOK_SECRET');
    var given = (e && e.parameter && e.parameter.secret) || '';
    if (secret && given !== secret) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'busy' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try {
      var p = props_();
      var last = Number(p.getProperty('LAST_WEBHOOK_RUN') || 0);
      var now = Date.now();
      if (now - last < 20000) {
        return ContentService.createTextOutput(JSON.stringify({ ok: true, skipped: 'throttled' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      p.setProperty('LAST_WEBHOOK_RUN', String(now));
      var report = syncAbsensi(false);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, report: report }))
        .setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* --------------------------- SPREADSHEET TARGET --------------------------- */

/**
 * Ambil spreadsheet target. Skrip yang di-ikat (Extensions → Apps Script)
 * langsung dapat; skrip mandiri (script.google.com) butuh Script Property
 * SHEET_ID supaya tetap bisa jalan.
 */
function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = (props_().getProperty('SHEET_ID') || '').trim();
  if (!id) {
    throw new Error('Skrip ini tidak terikat ke spreadsheet mana pun. ' +
      'Isi Script Property SHEET_ID dengan ID spreadsheet (bagian di antara /d/ dan /edit pada URL).');
  }
  return SpreadsheetApp.openById(id);
}

/** Tampilkan hasil. Skrip mandiri (script.google.com) tidak punya UI → masuk log saja. */
function alert_(text) {
  Logger.log(text);
  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (err) {
    // dijalankan dari script.google.com / trigger: laporan cukup di Logger
  }
}

/* ------------------------------- REST SUPABASE ---------------------------- */

function fetchAll_(cfg, table, select, filters) {
  var base = cfg.url.replace(/\/+$/, '') + '/rest/v1/' + table;
  var query = 'select=' + encodeURIComponent(select);
  (filters || []).forEach(function (f) { query += '&' + f; });

  var rows = [];
  var pageSize = 1000;
  var offset = 0;

  while (true) {
    var url = base + '?' + query + '&limit=' + pageSize + '&offset=' + offset;
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key,
        Accept: 'application/json',
      },
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error('Supabase ' + table + ' → HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
    }
    var batch = JSON.parse(res.getContentText() || '[]');
    rows = rows.concat(batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

/* ---------------------------------- UTIL --------------------------------- */

function normalizeNim_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  var s = String(v).trim().replace(/[’'`]/g, '');
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) {
    var n = Number(s);
    if (isFinite(n)) return String(Math.round(n));
  }
  s = s.replace(/\.0+$/, '');
  return s.replace(/[\s\u00a0]/g, '');
}

function normalizeLabel_(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Kunci pencocokan label header. Di spreadsheet, label kolom bisa tersimpan
 * sebagai angka ("1" untuk "1.0", "5" untuk "5.0"), jadi angka & teks
 * disamakan: 1 → '1', '1.0' → '1', '3&4' → '3&4'.
 */
function columnKey_(v) {
  var s = normalizeLabel_(v);
  if (/^\d+(\.0+)?$/.test(s)) return s.replace(/\.0+$/, '');
  return s;
}

/** "Modul 1 - S1 Teknik Elektro A" → "modul 1" */
function meetingKeyFromTitle_(title) {
  var head = String(title || '').split(' - ')[0];
  return normalizeLabel_(head);
}

/** "Modul 1 - S1 Teknik Elektro A" → { major: 'S1 Teknik Elektro', classCode: 'A' } */
function classFromTitle_(title) {
  var parts = String(title || '').split(' - ');
  if (parts.length < 2) return null;
  var tail = parts[parts.length - 1].trim();
  var m = tail.match(/^(.*?)\s+([A-Za-z])$/);
  if (!m) return null;
  return { major: m[1].trim(), classCode: m[2].toUpperCase() };
}

/** (major, classCode) → nama sheet, contoh ('Teknik Elektro','A') → 'TE A' */
function sheetNameFor_(major, classCode) {
  var prefix = null;
  for (var i = 0; i < MAJOR_PREFIX.length; i++) {
    if (MAJOR_PREFIX[i][0].test(String(major || ''))) { prefix = MAJOR_PREFIX[i][1]; break; }
  }
  if (!prefix) return null;
  var code = String(classCode || '').trim().toUpperCase().replace(/^KELAS\s+/, '');
  if (!code) return null;
  var letter = code.match(/[A-Z]$/);
  if (!letter) return null;
  return prefix + ' ' + letter[0];
}

function wibDate_(isoString, tz) {
  if (!isoString) return '';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function isPresent_(status) {
  return PRESENT_STATUSES.indexOf(String(status || '').trim()) !== -1;
}

/* ------------------------- LAYOUT SPREADSHEET ---------------------------- */

/**
 * Cari baris header kolom kehadiran & kolom NIM pada satu sheet.
 * Mengembalikan { headerRow, nimCol, columns: { label: colNumber } } (1-based).
 */
function findLayout_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), 12);
  var scanRows = Math.min(lastRow, 15);
  if (scanRows < 1) return null;

  var values = sheet.getRange(1, 1, scanRows, lastCol).getValues();

  var headerRow = -1;
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (normalizeLabel_(values[r][c]) === normalizeLabel_(PENGARAHAN_LABEL)) { headerRow = r + 1; break; }
    }
    if (headerRow > 0) break;
  }
  if (headerRow < 0) return null;

  var columns = {};
  var wanted = [PENGARAHAN_LABEL].concat(MEETING_COLUMNS);
  var headerCells = values[headerRow - 1];
  for (var i = 0; i < headerCells.length; i++) {
    var label = columnKey_(headerCells[i]);
    for (var w = 0; w < wanted.length; w++) {
      // Kemunculan PERTAMA yang dipakai: blok "Kehadiran (10%)" ada di paling kiri.
      if (label === columnKey_(wanted[w]) && !(wanted[w] in columns)) {
        columns[wanted[w]] = i + 1;
      }
    }
  }

  var nimCol = -1;
  for (var rr = 0; rr < headerRow; rr++) {
    for (var cc = 0; cc < values[rr].length; cc++) {
      if (normalizeLabel_(values[rr][cc]) === 'nim') { nimCol = cc + 1; break; }
    }
    if (nimCol > 0) break;
  }

  return { headerRow: headerRow, nimCol: nimCol, columns: columns };
}

/* --------------------------- IDENTITAS MAHASISWA -------------------------- */

/**
 * Ambil data user. Nama kolom beda-beda antar-project/versi skema
 * (mis. `major` vs `division`), jadi daftar kolom dicoba dari yang paling
 * lengkap lalu mundur sampai ada yang diterima PostgREST.
 */
function fetchUsers_(cfg) {
  var candidates = [
    'id,username,full_name,nim,major,division,class_code,role',
    'id,username,full_name,nim,major,class_code,role',
    'id,username,full_name,major,class_code,role',
    'id,username,full_name,class_code'
  ];
  var lastErr = null;
  for (var i = 0; i < candidates.length; i++) {
    try {
      return fetchAll_(cfg, 'users', candidates[i]);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * NIM praktikan bisa duduk di kolom `nim` ATAU `username` — aplikasinya sendiri
 * mencocokkan keduanya (`ep.nim = u.nim OR ep.nim = u.username`). Kalau salah
 * satu saja yang dipakai, separuh mahasiswa akan dilaporkan "tidak ada di DB".
 */
function nimCandidates_(user) {
  var out = [];
  [user.nim, user.username].forEach(function (v) {
    var nim = normalizeNim_(v);
    if (nim && /^\d{6,}$/.test(nim) && out.indexOf(nim) === -1) out.push(nim);
  });
  return out;
}

/** Jurusan bisa ada di `major` atau `division`, tergantung versi skema. */
function majorOf_(user) {
  return user.major || user.division || '';
}

/* ------------------------------- INTI SYNC ------------------------------- */

/**
 * Sinkronisasi utama.
 * @param {boolean} dryRun true = hitung saja, tidak menulis apa pun.
 *                 Dipanggil tanpa argumen (Run dari editor) = SIMULASI, biar
 *                 tidak ada tulisan tak sengaja saat tes pertama.
 * @return {string} laporan ringkas.
 */
function syncAbsensi(dryRun) {
  if (arguments.length === 0) dryRun = true;

  var cfg = cfg_();
  if (!cfg.url || !cfg.key) {
    return 'Kredensial Supabase belum diisi. Jalankan menu "Set kredensial Supabase".';
  }

  var ss = getSpreadsheet_();
  var startedAt = new Date();

  /* ---- 1. Tarik data dari Supabase ---- */
  var users = fetchUsers_(cfg);
  var logs = fetchAll_(cfg, 'attendance_logs',
    'id,custom_user_id,status,check_in_time,session_id,type,meeting',
    ['check_in_time=gte.' + encodeURIComponent(cfg.syncFrom + 'T00:00:00+07:00')]);
  var sessions = fetchAll_(cfg, 'qr_sessions', 'id,title');

  /* ---- 2. Indeks di memori ---- */
  var sessionById = {};
  sessions.forEach(function (s) { sessionById[String(s.id)] = s; });

  var userById = {};
  users.forEach(function (u) { userById[String(u.id)] = u; });

  // (sheetName|nim) → array boolean panjang MEETING_COLUMNS.length
  var marks = {};
  // sheetName → { tanggal → { indeksKolom: true } } — dipakai untuk absen lama tanpa penanda pertemuan
  var dateToColumn = {};
  var unmatchedTitles = {};
  var manualWithoutDate = 0;
  // Asal-usul kolom: berguna untuk tahu seberapa banyak data yang masih "nebak".
  var sourceCount = { meeting: 0, sesiQr: 0, tanggal: 0 };

  function ensureMarks(sheetName, nim) {
    var key = sheetName + '|' + nim;
    if (!marks[key]) marks[key] = new Array(MEETING_COLUMNS.length).fill(false);
    return marks[key];
  }

  /**
   * Tandai satu user di sheet-nya. NIM bisa ada di `nim` dan/atau `username`,
   * jadi keduanya ditandai supaya baris di sheet tetap ketemu walau DB
   * menyimpan identitasnya di kolom yang berbeda.
   */
  function markUser_(sheetName, user, apply) {
    var nims = nimCandidates_(user);
    for (var i = 0; i < nims.length; i++) apply(ensureMarks(sheetName, nims[i]));
  }

  // Statistik identitas: untuk membedakan "user belum ada di DB" dari
  // "user ada tapi kolom identitasnya lain".
  var idStats = { tanpaNim: 0, nimDariKolomNim: 0, nimDariUsername: 0, tanpaMajor: 0, majorDariDivision: 0 };
  users.forEach(function (u) {
    var nims = nimCandidates_(u);
    if (!nims.length) idStats.tanpaNim++;
    var dariNim = normalizeNim_(u.nim);
    if (dariNim && /^\d{6,}$/.test(dariNim)) idStats.nimDariKolomNim++;
    else if (nims.length) idStats.nimDariUsername++;
    if (!u.major && u.division) idStats.majorDariDivision++;
    if (!majorOf_(u)) idStats.tanpaMajor++;
  });

  function meetingIndexFromLabel_(label) {
    var key = normalizeLabel_(label);
    return Object.prototype.hasOwnProperty.call(MEETING_KEY_TO_INDEX, key)
      ? MEETING_KEY_TO_INDEX[key]
      : undefined;
  }

  /* ---- 3. Pass 1: sesi QR → peta tanggal → kolom, per kelas ---- */
  logs.forEach(function (log) {
    var user = userById[String(log.custom_user_id)];
    if (!user) return;
    var sheetName = sheetNameFor_(majorOf_(user), user.class_code);
    if (!sheetName) return;

    var session = log.session_id ? sessionById[String(log.session_id)] : null;
    if (!session) return;

    var key = meetingKeyFromTitle_(session.title);
    var idx = meetingIndexFromLabel_(key);
    if (idx === undefined) {
      if (key !== '' && key !== normalizeLabel_(PENGARAHAN_LABEL)) {
        unmatchedTitles[key] = (unmatchedTitles[key] || 0) + 1;
      }
      return;
    }
    var day = wibDate_(log.check_in_time, cfg.timezone);
    if (!dateToColumn[sheetName]) dateToColumn[sheetName] = {};
    if (!dateToColumn[sheetName][day]) dateToColumn[sheetName][day] = {};
    dateToColumn[sheetName][day][idx] = true;
  });

  /* ---- 4. Pass 2: tiap absen Hadir → kolom ---- */
  // Urutan prioritas: kolom `meeting` (dipilih asisten) > judul sesi QR > tanggal.
  logs.forEach(function (log) {
    if (!isPresent_(log.status)) return;

    var user = userById[String(log.custom_user_id)];
    if (!user) return;
    var sheetName = sheetNameFor_(majorOf_(user), user.class_code);
    if (!sheetName) return;

    var idx = meetingIndexFromLabel_(log.meeting);
    var source = 'meeting';

    if (idx === undefined) {
      var session = log.session_id ? sessionById[String(log.session_id)] : null;
      if (session) {
        idx = meetingIndexFromLabel_(meetingKeyFromTitle_(session.title));
        source = 'sesiQr';
      }
    }

    if (idx === undefined) {
      var day = wibDate_(log.check_in_time, cfg.timezone);
      var map = dateToColumn[sheetName] && dateToColumn[sheetName][day];
      if (!map) { manualWithoutDate++; return; }
      markUser_(sheetName, user, function (m) {
        Object.keys(map).forEach(function (k) { m[Number(k)] = true; });
      });
      sourceCount.tanggal++;
      return;
    }

    markUser_(sheetName, user, function (m) { m[idx] = true; });
    sourceCount[source]++;
  });

  /* ---- 5. Tulis ke spreadsheet ---- */
  var report = [];
  var totalRowsTouched = 0;
  var totalTrueCells = 0;
  var missingBySheet = {};

  ss.getSheets().forEach(function (sheet) {
    var layout = findLayout_(sheet);
    if (!layout || layout.nimCol < 0) {
      report.push('• ' + sheet.getName() + ': header kehadiran/NIM tidak ditemukan — dilewati.');
      return;
    }

    var lastRow = sheet.getLastRow();
    var firstDataRow = layout.headerRow + 1;
    var numRows = lastRow - firstDataRow + 1;

    var managedLabels = MEETING_COLUMNS.slice();
    if (cfg.syncPengarahan) managedLabels = [PENGARAHAN_LABEL].concat(managedLabels);

    var minCol = Infinity, maxCol = -Infinity;
    managedLabels.forEach(function (l) {
      var c = layout.columns[l];
      if (c) { minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c); }
    });
    if (numRows < 1 || minCol === Infinity) {
      report.push('• ' + sheet.getName() + ': tidak ada baris data — dilewati.');
      return;
    }

    var block = sheet.getRange(firstDataRow, minCol, numRows, maxCol - minCol + 1).getValues();
    var nimRange = sheet.getRange(firstDataRow, layout.nimCol, numRows, 1).getValues();

    var sheetTrue = 0;
    var changed = 0;
    var missing = [];

    for (var r = 0; r < numRows; r++) {
      var nim = normalizeNim_(nimRange[r][0]);
      if (!nim) continue;

      // NB: jangan pakai nama `marks` di sini — akan menutupi indeks global (hoisting var).
      var rowMarks = marks[sheet.getName() + '|' + nim];
      if (!rowMarks) { missing.push(nim); continue; }

      for (var i = 0; i < managedLabels.length; i++) {
        var label = managedLabels[i];
        var col = layout.columns[label];
        if (!col) continue;
        var c = col - minCol;

        var isMeeting = MEETING_COLUMNS.indexOf(label) !== -1;
        var target = isMeeting ? rowMarks[MEETING_COLUMNS.indexOf(label)] : false;
        var current = block[r][c] === true || String(block[r][c]).toUpperCase() === 'TRUE';

        var next;
        if (isMeeting) {
          next = target ? true : (cfg.overwriteFalse ? false : current);
        } else {
          next = target ? true : current; // Pengarahan: hanya diisi kalau diminta
        }

        if (next !== current) changed++;
        if (next) sheetTrue++;
        block[r][c] = next;
      }
      totalRowsTouched++;
    }

    if (!dryRun && changed > 0) {
      sheet.getRange(firstDataRow, minCol, numRows, maxCol - minCol + 1).setValues(block);
    }

    totalTrueCells += sheetTrue;
    if (missing.length) missingBySheet[sheet.getName()] = missing;
    var line = '• ' + sheet.getName() + ': ' + numRows + ' baris, ' +
      sheetTrue + ' checkbox terisi' + (dryRun ? '' : ', ' + changed + ' sel diubah');
    if (missing.length) line += ' (' + missing.length + ' NIM tidak ada di DB: ' + missing.slice(0, 5).join(', ') + ')';
    report.push(line);
  });

  /* ---- 6. Ringkasan ---- */
  var host = (cfg.url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || ['', cfg.url])[1];
  var head = (dryRun ? 'SIMULASI — ' : 'SYNC — ') +
    'data sampai ' + Utilities.formatDate(startedAt, cfg.timezone, 'yyyy-MM-dd HH:mm') + ' WIB';
  var foot = ['', 'Project: ' + host + ' | sheet: ' + ss.getName(),
    'Users: ' + users.length + ' | log absen: ' + logs.length + ' | sesi QR: ' + sessions.length,
    'Identitas user: NIM di kolom nim=' + idStats.nimDariKolomNim +
      ', lewat username=' + idStats.nimDariUsername +
      ', tanpa NIM=' + idStats.tanpaNim,
    'Jurusan: kosong di kolom major=' + idStats.majorDariDivision +
      ' (dipakai kolom division) | tanpa jurusan=' + idStats.tanpaMajor,
    'Siswa terpetakan: ' + Object.keys(marks).length + ' | baris diproses: ' + totalRowsTouched,
    'Checkbox TRUE total: ' + totalTrueCells,
    'Sumber kolom: pilihan Pertemuan=' + sourceCount.meeting +
      ', judul sesi QR=' + sourceCount.sesiQr +
      ', cocok tanggal=' + sourceCount.tanggal];

  if (manualWithoutDate > 0) {
    foot.push('Absen Hadir tanpa pertemuan & tanpa sesi QR sejenis: ' + manualWithoutDate +
      ' (asisten perlu memilih dropdown Pertemuan di halaman Absensi)');
  }
  var unmatched = Object.keys(unmatchedTitles);
  if (unmatched.length) {
    foot.push('Judul sesi belum dikenali: ' + unmatched.map(function (k) {
      return '"' + k + '" (' + unmatchedTitles[k] + ')';
    }).join(', '));
  }

  // Kelas yang terpetakan dari DB tapi sheet-nya tidak ada di spreadsheet ini.
  var sheetNames = ss.getSheets().map(function (s) { return s.getName(); });
  var mappedSheets = {};
  Object.keys(marks).forEach(function (k) { mappedSheets[k.split('|')[0]] = true; });
  var orphan = Object.keys(mappedSheets).filter(function (n) { return sheetNames.indexOf(n) === -1; });
  if (orphan.length) foot.push('Kelas tanpa sheet (dilewati): ' + orphan.join(', '));

  var text = head + '\n' + report.join('\n') + foot.join('\n');

  // Daftar lengkap NIM tak dikenal — terlalu panjang untuk dialog, jadi hanya
  // masuk Execution log (View → Logs) supaya bisa dipakai mengecek data DB.
  var detail = ['', '--- DAFTAR LENGKAP NIM TIDAK DITEMUKAN DI DB ---'];
  Object.keys(missingBySheet).forEach(function (name) {
    detail.push(name + ' (' + missingBySheet[name].length + '): ' + missingBySheet[name].join(', '));
  });
  var totalMissing = Object.keys(missingBySheet).reduce(function (a, k) {
    return a + missingBySheet[k].length;
  }, 0);
  if (!totalMissing) detail.push('(tidak ada — semua NIM di sheet ketemu di DB)');

  Logger.log(text);
  Logger.log(detail.join('\n'));
  return text;
}
