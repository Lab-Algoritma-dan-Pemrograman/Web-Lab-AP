// ponytail: Import dari alias sonner-original agar Vite memprosesnya sebagai package dependency dengan benar
import { toast as originalToast } from "sonner-original";

// Helper untuk menerjemahkan pesan default yang kaku menjadi pesan akademik yang ceria & penuh emoji!
const makeCheerful = (msg: any): any => {
  if (typeof msg !== 'string') return msg;

  const lower = msg.toLowerCase();
  
  // Sukses menyimpan data / entri
  if (lower.includes("berhasil disimpan") || lower.includes("sukses disimpan") || lower.includes("saved successfully")) {
    return `Yeay! Data berhasil disimpan dengan aman! 🎉✨`;
  }
  
  // Sukses menghapus data / entri
  if (lower.includes("dihapus") || lower.includes("deleted")) {
    return `Sip! Data telah berhasil dihapus dari sistem! 🗑️👋`;
  }

  // Sukses memperbarui / update
  if (lower.includes("berhasil diperbarui") || lower.includes("berhasil diupdate")) {
    return `Mantap! Pembaruan berhasil diterapkan! 🚀🌟`;
  }
  
  // Sukses generik
  if (lower.includes("berhasil") || lower.includes("sukses") || lower.includes("success")) {
    return `Hore! Aksi kamu berhasil dilaksanakan! 🥳🚀`;
  }
  
  // Error / Kegagalan
  if (lower.includes("gagal") || lower.includes("error") || lower.includes("failed")) {
    const cleanMsg = msg.replace(/gagal( melakukan)?\s*:\s*/gi, "").replace(/error\s*:\s*/gi, "");
    return `Oops! Ada sedikit kendala: "${cleanMsg}" 🥺 Coba cek kembali ya!`;
  }
  
  // Selamat datang / login
  if (lower.includes("selamat datang") || lower.includes("welcome")) {
    return `Halo! Selamat datang kembali di Lab AP! Semangat belajar dan berkarya! 💻🌟`;
  }

  // Default: Tambahkan emoji keceriaan agar tidak flat
  return `${msg} 🎉`;
};

// Bungkus seluruh method utama toast dari sonner
export const toast = Object.assign(
  (message: any, options?: any) => {
    return originalToast(makeCheerful(message), options);
  },
  {
    success: (message: any, options?: any) => {
      return originalToast.success(makeCheerful(message), options);
    },
    error: (message: any, options?: any) => {
      return originalToast.error(makeCheerful(message), options);
    },
    warning: (message: any, options?: any) => {
      return originalToast.warning(makeCheerful(message), options);
    },
    info: (message: any, options?: any) => {
      return originalToast.info(makeCheerful(message), options);
    },
    custom: originalToast.custom,
    dismiss: originalToast.dismiss,
    promise: originalToast.promise,
  }
);

// Ekspor Toaster dari original package
export { Toaster } from "sonner-original";
