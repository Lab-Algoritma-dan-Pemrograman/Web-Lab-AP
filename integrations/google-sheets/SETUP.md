# Sinkronisasi Absensi → Spreadsheet Penilaian

Absen di Web Lab AP (`attendance_logs` di Supabase) otomatis mengisi checkbox
**Kehadiran (10%)** di spreadsheet Penilaian Praktikum.

```
QR / input manual  →  Supabase attendance_logs  →  Apps Script  →  checkbox sheet
```

**Kolom yang dikelola** (baris header, kolom E–K):

| Kolom | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|
| Label | Pengarahan | 1.0 | 2.0 | 3&4 | 5.0 | 6.0 | Ujian Praktik |

- `TRUE` = mahasiswa **Hadir** di pertemuan itu.
- Kolom **Pengarahan default tidak disentuh** (sesuai permintaan). Mau ikut?
  set properti `SYNC_PENGARAHAN = true`.
- Default **tidak ada checkbox yang di-FALSE-kan** — sync hanya menyalakan.
  Mau spreadsheet jadi cerminan penuh DB? set `OVERWRITE_FALSE = true`.

## Pertemuan → kolom

Judul sesi QR dibuat halaman **Buat QR** dengan format
`"<Pertemuan> - <Jurusan> <Kelas>"`, contoh `Modul 1 - S1 Teknik Elektro A`.
Pemetaannya (ubah di `MEETING_KEY_TO_INDEX` dalam `Code.gs` kalau penamaan berubah):

| Judul sesi (Buat QR) | Kolom sheet |
|---|---|
| Pengarahan | Pengarahan *(dilewati)* |
| Modul 1 / Praktikum Modul 1 | 1.0 |
| Modul 2 | 2.0 |
| Modul 3&4 | 3&4 |
| Modul 5 | 5.0 |
| Modul 6 | 6.0 |
| Ujian Praktik | Ujian Praktik |

Daftar `BuatQR.tsx` memakai `Modul 3&4` + `Modul 5`, sedangkan kolom sheet
memakai `3&4` + `5.0`. Dua-duanya berisi 6 pertemuan dengan urutan sama, jadi
pemetaan di atas **posisional**: pertemuan ke-n → kolom ke-n.

Sheet kelas dipilih dari `users.major` + `users.class_code`:
`Teknik Elektro` + `E` → sheet **TE E**; `Sistem Energi` → prefix **TSE**;
`Tenaga Listrik` → **TL**.

## Langkah pasang

0. **Jalankan migrasi DB** (sekali saja)
   - Supabase → SQL Editor → jalankan
     `supabase/migrations/20261004141500_add_meeting_to_attendance_logs.sql`.
   - Ini menambah kolom `attendance_logs.meeting` dan parameter `p_meeting` pada
     `upsert_attendance_log_secure`. Tanpa ini, dropdown Pertemuan di aplikasi
     akan error dan absen manual tetap tanpa penanda pertemuan.

1. **Buat Google Sheet-nya**
   - Google Drive → New → File upload → `Penilaian Praktikum.xlsx` → Open with Google Sheets.
   - Cek nama sheet tetap: `TL A`, `TE A`…`TE E`, `TSE A`…`TSE C`.
   - Baris header kehadiran ada di **baris 2**, NIM di **kolom B**, data mulai baris 3.
   - Kalau checkbox hasil import jadi teks `TRUE`/`FALSE`: blok kolom E–K → Insert → **Checkbox**.

2. **Tempel script**
   - Di sheet: menu **Extensions → Apps Script**.
   - Hapus isi `Code.gs` bawaan, tempel seluruh isi `integrations/google-sheets/Code.gs`, Save.
   - **Kalau menu Extensions tidak ada** — itu bukan bug sheet. Menu itu hanya ada
     di Google Sheets versi **browser desktop**:
     - jangan dibuka dari app HP (Android/iOS): di sana menunya memang tidak ada;
     - pastikan filenya sudah jadi Google Sheets, bukan `.xlsx` yang dibuka di Excel.
       Upload ke Drive → klik kanan → *Open with → Google Sheets* → kalau muncul
       banner "Excel format", klik **Save as Google Sheets**.
       URL yang benar: `docs.google.com/spreadsheets/d/<ID>/edit`.
   - **Jalan alternatif tanpa Extensions** (skrip mandiri):
     1. buka <https://script.google.com> → **New project** → tempel `Code.gs`;
     2. **Project Settings → Script properties** → tambah tiga properti:
        `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, dan `SHEET_ID`
        (ID = bagian di antara `/d/` dan `/edit` pada URL spreadsheet);
     3. jalankan fungsi **`syncAbsensi`** dari editor (bukan dari menu — menu
        `⚙️ Web Lab AP` tidak ada di mode ini), izinkan akses saat diminta;
     4. laporan muncul di **Execution log** (View → Logs).
     Trigger 10 menit tetap bisa: fungsi `installTrigger` dipanggil manual dari editor.

3. **Isi kredensial**
   - Supabase → Project Settings → API → copy **Project URL** dan **service_role** key.
   - Ambil dari **project yang dipakai asisten sehari-hari**. Kalau salah project,
     laporan akan `0 checkbox` dan `NIM tidak ada di DB` hampir semua — itu tandanya
     salah database, bukan salah script.
   - Di sheet, reload halaman → menu **⚙️ Web Lab AP → 🔑 Set kredensial Supabase**.
   - Key tersimpan di Script Properties (tidak ikut terunduh kalau sheet di-share).

   Properti opsional (Apps Script → Project Settings → Script properties):

   | Properti | Default | Arti |
   |---|---|---|
   | `SYNC_FROM` | `2026-09-01` | Ambil absen sejak tanggal ini (WIB) |
   | `SYNC_PENGARAHAN` | `false` | `true` = kolom Pengarahan juga ditulis |
   | `OVERWRITE_FALSE` | `false` | `true` = checkbox kosong ikut di-FALSE-kan |
   | `TIMEZONE` | `Asia/Jakarta` | Zona waktu pembacaan tanggal absen |
   | `WEBHOOK_SECRET` | *(kosong)* | Hanya untuk mode webhook (langkah 6) |

4. **Tes kering**
   - Dari menu sheet: **🧪 Simulasi (tidak menulis)**. Dari editor Apps Script:
     pilih fungsi **`testSimulasi`** → Run (laporan masuk **Execution log**).
   - Muncul laporan: berapa baris, berapa checkbox bakal terisi, NIM mana yang
     tidak ketemu di DB.
   - Baru kalau angkanya masuk akal: menu **🔄 Sync absensi sekarang** (dari editor:
     fungsi **`syncSekarang`**). Menjalankan `syncAbsensi` **tanpa argumen** dari
     editor = simulasi juga — aman dari tulisan tak sengaja.
   - Pertama kali Run, Google minta izin: **Review permissions → pilih akun →
     Advanced → Go to "…" (unsafe) → Allow**. Itu wajar untuk skrip sendiri.

5. **Otomatis tiap 10 menit**
   - Menu **⏱️ Pasang / perbarui trigger otomatis** → izinkan akses saat diminta.
   - Ganti interval: ubah `installTrigger(10)` → `installTrigger(5)` kalau mau lebih rapat.

6. **Opsional — real-time (webhook)**
   - Apps Script → Deploy → New deployment → type **Web app**,
     *Execute as*: Me, *Who has access*: **Anyone** → copy URL `/exec`.
   - Set Script property `WEBHOOK_SECRET` (string acak).
   - Supabase → Database → Webhooks → Create:
     table `attendance_logs`, events Insert/Update/Delete,
     URL `https://script.google.com/macros/s/XXXX/exec?secret=<WEBHOOK_SECRET>`.
   - Satu sesi QR memicu puluhan insert — endpoint sudah throttle 20 detik.

## Catatan / batasan

- **Urutan penentuan kolom** (paling dipercaya dulu):
  1. kolom `attendance_logs.meeting` — dipilih asisten lewat dropdown **Pertemuan**
     di halaman Absensi (wajib diisi saat simpan massal);
  2. judul sesi QR, kalau absen lewat scan QR;
  3. **tanggal** absen dicocokkan dengan sesi QR kelas yang sama hari itu
     (dipakai untuk data lama sebelum kolom `meeting` ada).
- Laporan sync menampilkan asalnya: `Sumber kolom: pilihan Pertemuan=n, judul sesi QR=n, cocok tanggal=n`.
  Kalau angka "cocok tanggal" masih besar, itu data lama — aman.
- Baris `Hadir` yang tidak punya pertemuan **dan** tidak punya sesi QR sejenis
  dilaporkan sebagai *"Absen Hadir tanpa pertemuan & tanpa sesi QR sejenis"* dan
  tidak dicentang. Solusinya: asisten pilih dropdown Pertemuan saat input.
- **Izin/Sakit tidak dicentang** (hanya status `Hadir`).
- Hapus log absen di aplikasi tidak otomatis menghapus centang kecuali
  `OVERWRITE_FALSE = true`.
- NIM di sheet dibandingkan sebagai angka: `202611006` = `202611006`.
  NIM yang belum ada di DB dilaporkan di akhir laporan.

## Uji lokal tanpa Google Apps Script

```bash
node integrations/google-sheets/test-harness.mjs
# atau tunjuk spreadsheet lain: node integrations/google-sheets/test-harness.mjs "D:/path/Penilaian Praktikum.xlsx"
```

Harness men-stub `SpreadsheetApp`/`UrlFetchApp`, membaca layout asli dari file
`Penilaian Praktikum.xlsx`, lalu memverifikasi 19 kasus: pemetaan NIM→baris,
judul sesi→kolom, alias `Praktikum Modul 1`, prioritas kolom `meeting` di atas
tanggal, absen manual tanpa sesi, izin tidak dicentang, kolom Pengarahan tidak
tersentuh, dan judul sesi tak dikenal.
