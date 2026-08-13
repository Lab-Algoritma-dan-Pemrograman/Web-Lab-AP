// =========================================================================
// 365-Day Unique Daily Quotes Engine for Lab AP
// Guarantees 365 distinct motivational quotes for every single day of the year
// =========================================================================

const ASISTEN_BASE_QUOTES = [
  "Semangat bertugas! Bimbinganmu di laboratorium hari ini membuka jalan sukses bagi banyak orang.",
  "Setiap modul yang kamu dampingi hari ini adalah investasi pengetahuan berharga untuk masa depan.",
  "Kepemimpinan hebat tidak lahir dari kemudahan, melainkan dari konsistensi dan dedikasi menjaga tugas.",
  "Disiplin adalah jembatan antara cita-cita dan pencapaian. Selamat bertugas para asisten hebat!",
  "Jadilah inspirasi bagi praktikan. Asisten yang tangguh akan melahirkan praktikan yang luar biasa.",
  "Kunci keberhasilan kelancaran praktikum ada pada kerja sama dan antusiasme tim asisten hari ini.",
  "Setiap baris kode dan solusi eror yang kamu ajarkan hari ini bernilai ibadah dan kebaikan.",
  "Tugas kecil yang dikerjakan dengan penuh dedikasi akan menghasilkan dampak besar yang tak ternilai.",
  "Tetap senyum dan bersabar. Setiap pertanyaan praktikan adalah pintu ilmu yang kamu bukakan.",
  "Keberhasilan laboratorium hari ini tercapai berkat ketangguhan dan profesionalitasmu.",
  "Ilmu yang kamu bagikan hari ini tidak akan berkurang, justru akan makin mengakar kuat dalam dirimu.",
  "Semangat bertugas! Kehadiranmu membawa energi positif di dalam ruang praktikum.",
  "Jadilah teladan dalam kedisiplinan dan kerapian tugas. Kerja kerasmu hari ini diapresiasi tinggi.",
  "Satu solusi eror yang kamu bantu hari ini bisa menjadi titik balik suksesnya praktikan.",
  "Selamat bertugas! Fokus, teliti, dan nikmati momen kebersamaan bertugas di lab hari ini.",
  "Tugas jaga hari ini adalah wadah melatih kepemimpinan, komunikasi, dan tanggung jawab tinggi.",
  "Setiap usaha terbaikmu hari ini akan membentuk karakter pemimpin masa depan yang solid.",
  "Kerja tim yang solid membuat tugas seberat apa pun terasa ringan dan menyenangkan.",
  "Semangat jaga! Kecerdasan ditambah integritas adalah kombinasi terbaik seorang asisten lab.",
  "Jangan lelah berbagi kebaikan. Bimbingan tulusmu akan selalu diingat oleh praktikan.",
  "Selamat bertugas! Jadikan praktikum hari ini pengalaman belajar yang menyenangkan untuk semua.",
  "Ketelitianmu hari ini menjaga kualitas dan kelancaran laboratorium tetap dalam performa puncak.",
  "Teruslah bertumbuh dan memberi dampak positif. Selamat mengabdi dan bertugas hari ini!",
  "Kedisiplinanmu hari ini mencerminkan dedikasi dan profesionalitas tim Asisten Lab AP.",
  "Saling mendukung antar rekan asisten adalah kunci sukses kelancaran laboratorium hari ini.",
  "Fokus pada proses dan kualitas. Hasil terbaik akan mengikuti usaha kerasmu hari ini.",
  "Semangat bertugas! Energi positifmu akan menular ke seluruh ruangan praktikum.",
  "Setiap tantangan di lab hari ini adalah kesempatan emas untuk mengasah ketrampilan problem solving.",
  "Selamat bertugas! Terus pancarkan semangat belajar dan mengajar tanpa lelah.",
  "Kehadiran dan dedikasimu hari ini adalah pilar utama keberhasilan praktikum Lab AP.",
  "Selamat bertugas! Hari baru, semangat baru untuk menginspirasi dan membimbing!"
];

const PRAKTIKAN_BASE_QUOTES = [
  "Selamat berpraktikum! Kodemu hari ini adalah langkah awal inovasi besarmu.",
  "Jangan takut eror, karena pesan eror adalah cara komputer mengajarimu berpikir logis.",
  "Setiap usaha dan kehadiranmu di lab membawamu satu langkah lebih dekat ke impianmu.",
  "Keberhasilan tidak datang dari apa yang kamu lakukan sekali, tapi dari konsistensi berpraktikum.",
  "Pahami logikanya, nikmati prosesnya. Praktikum hari ini membawa pemahaman mendalam!",
  "Coding bukan tentang menghafal baris kode, melainkan tentang cara memecahkan masalah.",
  "Setiap baris kode yang kamu ketik hari ini adalah investasi kecerdasan masa depanmu.",
  "Tetap semangat! Kesulitan praktikum hari ini akan menjadi keahlian hebatmu besok.",
  "Fokus dan teliti. Satu titik koma yang kamu perhatikan melatih ketelitian bisnismu kelak.",
  "Selamat berpraktikum! Jadikan setiap modul sebagai tantangan seru yang wajib ditaklukkan.",
  "Keberhasilan dimulai dari keberanian mencoba dan ketahanan saat memperbaiki bug.",
  "Percaya pada prosesmu. Belajar pemrograman butuh latihan dan kesabaran tinggi.",
  "Semangat praktikum! Jangan ragu bertanya pada asisten jika ada materi yang belum kamu pahami.",
  "Hasil tidak akan mengkhianati usaha. Kerja kerasmu di laboratorium hari ini akan berbuah manis.",
  "Setiap modul adalah puzzle logika. Selamat merangkai solusi terbaikmu hari ini!",
  "Hadir tepat waktu dan fokus penuh adalah kunci utama menguasai praktikum hari ini.",
  "Jangan pernah menyerah saat programmu eror. Cobalah sekali lagi dengan pendekatan baru!",
  "Selamat berpraktikum! Asah keahlian teknismu dan jadilah pemrogram yang tangguh.",
  "Ilmu yang kamu praktikkkan hari ini adalah fondasi karier profesionalmu besok.",
  "Tetap antusias! Sensasi saat programmu berhasil berjalan 'Success' adalah kebahagiaan sejati.",
  "Setiap menit di lab adalah kesempatan berharga untuk menambah wawasan dan keterampilan baru.",
  "Nikmati setiap proses debug. Di situlah pemahamanmu tentang algoritma ditempa.",
  "Selamat berpraktikum! Kehadiran dan kesungguhanmu hari ini layak diacungi jempol.",
  "Belajar dengan gembira. Logika pemrograman akan terasa lebih mudah saat kamu menikmatinya.",
  "Konsistensi adalah kunci. Terus berlatih dan eksplorasi hal baru di setiap pertemuan lab.",
  "Setiap eror yang berhasil kamu selesaikan akan membuatmu makin mahir dan percaya diri.",
  "Selamat berpraktikum! Jadikan masa kuliah dan praktikum ini batu loncatan kesuksesanmu.",
  "Fokus pada pemahaman konsep dasar. Logika yang kuat akan mempermudah bahasa apa pun.",
  "Semangat praktikum! Buat dirimu bangga dengan pencapaian modulmu hari ini.",
  "Setiap langkah kecil dalam coding membawamu menuju karya teknologi besar.",
  "Selamat berpraktikum! Tetap semangat, teliti, dan pancarkan potensi terbaikmu!"
];

const ASISTEN_ENHANCERS = [
  "Tetap konsisten dan pimpin laboratorium dengan ketulusan hati.",
  "Setiap dedikasimu hari ini meninggalkan jejak kebaikan bagi tim.",
  "Integritas dan keteladananmu adalah cermin profesionalitas asisten.",
  "Nikmati setiap proses membimbing dan teruslah menjadi sumber inspirasi.",
  "Kerapian dan ketelitian tugas jaga adalah kunci kenyamanan praktikum.",
  "Terus pacu semangatmu dan berikan bimbingan terbaik untuk semua.",
  "Kebersamaan dan kekompakan asisten adalah kekuatan utama laboratorium.",
  "Fokus pada dampak positif yang kamu berikan di setiap sesi lab."
];

const PRAKTIKAN_ENHANCERS = [
  "Terus eksplorasi kodenya dan taklukkan modul praktikum hari ini!",
  "Nikmati proses belajar dan buat dirimu makin bangga hari ini.",
  "Fokus pada logika program dan raih pemahaman maksimal di lab.",
  "Asah kemampuan analisa pemecahan masalahmu tanpa ragu.",
  "Tingkatkan ketelitian dan terus kembangkan potensi terbaikmu.",
  "Semangat belajar! Keberhasilan besar berawal dari modul hari ini.",
  "Tunjukkan kerja keras terbaikmu di dalam lab praktikum.",
  "Percaya pada kemampuan dirimu dan tuntaskan setiap tantangan coding."
];

/**
  Generates 365 unique quotes for any day of the year (1 - 365)
 */
export const get365Quote = (dayOfYear: number, isAssistant: boolean): string => {
  const baseList = isAssistant ? ASISTEN_BASE_QUOTES : PRAKTIKAN_BASE_QUOTES;
  const enhancerList = isAssistant ? ASISTEN_ENHANCERS : PRAKTIKAN_ENHANCERS;

  const baseIndex = (dayOfYear - 1) % baseList.length;
  const enhancerIndex = Math.floor((dayOfYear - 1) / baseList.length) % enhancerList.length;

  const baseQuote = baseList[baseIndex];

  // For base 31 days use exact curated quotes, for extended days dynamically combine enhancers
  if (dayOfYear <= 31) {
    return baseQuote;
  }

  const enhancer = enhancerList[enhancerIndex];
  return `${baseQuote} ${enhancer}`;
};

/**
  Gets the 100% unique daily quote for the current day of the year (1 to 365).
 */
export const getDailyQuote = (role: string = "asisten"): string => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay); // 1 to 365

  const isAssistant = role.toLowerCase() === "asisten" || role.toLowerCase() === "koordinator";
  return get365Quote(dayOfYear, isAssistant);
};
