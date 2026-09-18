# Lab AP - Manajemen Laboratorium & Praktikum

Sistem Informasi Manajemen Laboratorium dan Praktikum Terpadu untuk mengelola inventaris, penyewaan alat, dan administrasi laboratorium.

## Fitur Utama

- **Dashboard Manajemen**: Visualisasi data penggunaan laboratorium.
- **Manajemen Inventaris**: Pelacakan stok dan status barang.
- **Sistem Sewa & Pinjam**: Alur persetujuan peminjaman alat secara digital.
- **E-Learning & Sertifikasi**: Modul pembelajaran dan penilaian otomatis.
- **Integrasi WhatsApp**: Notifikasi dan koordinasi otomatis via WhatsApp.

## Teknologi yang Digunakan

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend/Database**: Supabase (PostgreSQL)
- **Otentikasi**: Supabase Auth

## Pengembangan Lokal

1. Clone repositori ini.
2. Jalankan `bun install` untuk menginstall dependensi.
3. Buat file `.env` dan masukkan konfigurasi Supabase Anda.
4. Jalankan server pengembangan dengan `bun run dev`.

> Proyek ini memakai **Bun**, bukan npm. Jangan jalankan `npm install` — dia bikin
> `package-lock.json` liar yang tidak dipakai CI dan bisa bentrok dengan `bun.lock`.

## Deployment

Proyek ini siap untuk di-deploy ke platform seperti Vercel atau Netlify. Pastikan Environment Variables (URL & Key Supabase) sudah dikonfigurasi di platform tersebut.
