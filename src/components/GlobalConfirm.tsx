import { useState, useEffect } from "react";
import { registerConfirmListener } from "@/lib/confirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function GlobalConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [resolveFn, setResolveFn] = useState<((val: boolean) => void) | null>(null);

  useEffect(() => {
    registerConfirmListener((msg, resolve) => {
      // Hilangkan emoji dan simbol bawaan di interseptor lama agar tidak double
      const cleanMessage = msg.replace(/^[🗑️⚠️👋✨\s]+/, "").replace(/[\s🌟]+$/, "");
      setMessage(cleanMessage);
      setResolveFn(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    if (resolveFn) resolveFn(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolveFn) resolveFn(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent className="max-w-md p-6 bg-[#FDFBF7] border-2 border-slate-200 shadow-[0_8px_0_#CBD5E1] rounded-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-lg font-black text-dark flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-red-50 text-maroon flex items-center justify-center shadow-[0_2px_0_#5C0E25] border border-red-200">
               <HelpCircle className="w-5 h-5" />
             </div>
             Konfirmasi Aksi
          </DialogTitle>
          <DialogDescription className="text-sm font-bold text-gray-600 leading-relaxed pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex sm:justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="rounded-xl border-2 border-slate-200 hover:bg-slate-50 font-bold px-5 py-2.5 h-auto text-gray-500 shadow-sm"
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            className="rounded-xl bg-maroon hover:bg-maroon-light text-white font-black px-6 py-2.5 h-auto shadow-[0_4px_0_#5C0E25] hover:-translate-y-0.5 active:translate-y-0 transition-transform"
          >
            Lanjutkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
