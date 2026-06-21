// ponytail: Promise-based confirm utility to trigger a custom React modal instead of native window.confirm
type ConfirmResolver = (value: boolean) => void;

let activeResolver: ConfirmResolver | null = null;
let activeListener: ((message: string, onResolve: ConfirmResolver) => void) | null = null;

export const confirm = (message: string): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    if (activeResolver) {
      activeResolver(false); // Batalkan dialog sebelumnya jika dipanggil beruntun
    }
    activeResolver = resolve;
    if (activeListener) {
      activeListener(message, (val) => {
        resolve(val);
        activeResolver = null;
      });
    } else {
      // Fallback ke native confirm jika komponen belum di-mount
      resolve(window.confirm(message));
    }
  });
};

export const registerConfirmListener = (
  listener: (message: string, onResolve: ConfirmResolver) => void
) => {
  activeListener = listener;
};
