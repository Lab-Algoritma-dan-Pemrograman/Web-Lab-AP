import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ponytail: Interseptor global untuk membuat native confirm browser lebih ramah & ceria
const originalConfirm = window.confirm;
window.confirm = (message: string): boolean => {
  let funMessage = message;
  const lower = message.toLowerCase();

  if (lower.includes("hapus barang")) {
    funMessage = "🗑️ Yakin ingin menghapus barang ini? Data yang terhapus tidak bisa dikembalikan loh, kawan! 🥺🔧";
  } else if (lower.includes("hapus")) {
    funMessage = "⚠️ Eits! Kamu yakin ingin menghapus data ini? Pikirkan matang-matang ya! 🧐✨";
  } else if (lower.includes("keluar") || lower.includes("logout")) {
    funMessage = "👋 Hei, yakin mau keluar sekarang? Kami bakal kangen nih! Klik OK kalau sudah mantap. 😉";
  } else {
    funMessage = `✨ ${message} (Klik OK untuk lanjut, Batal untuk cancel) 🌟`;
  }
  
  return originalConfirm(funMessage);
};

createRoot(document.getElementById("root")!).render(<App />);
