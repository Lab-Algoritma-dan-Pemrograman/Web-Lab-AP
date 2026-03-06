import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const qrcodeRegionId = "html5qr-code-full-region";

interface Props {
  fps?: number;
  qrbox?: number;
  aspectRatio?: number;
  disableFlip?: boolean;
  verbose?: boolean;
  qrCodeSuccessCallback: (decodedText: string, decodedResult: any) => void;
  qrCodeErrorCallback?: (errorMessage: string) => void;
}

const Html5QrcodePlugin = (props: Props) => {
  useEffect(() => {
    // Konfigurasi Scanner
    const config = {
      fps: props.fps || 10,
      qrbox: props.qrbox || 250,
      aspectRatio: props.aspectRatio || 1.0,
      disableFlip: props.disableFlip || false,
    };

    const verbose = props.verbose === true;

    // Inisialisasi Scanner
    // Hapus instance lama jika ada (cleanup) untuk mencegah error double render
    const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, config, verbose);
    
    html5QrcodeScanner.render(
      props.qrCodeSuccessCallback,
      props.qrCodeErrorCallback
    );

    // Cleanup saat komponen ditutup/pindah tab
    return () => {
      html5QrcodeScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, []);

  return <div id={qrcodeRegionId} />;
};

export default Html5QrcodePlugin;