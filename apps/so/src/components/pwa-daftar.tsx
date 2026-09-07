'use client';

import { useEffect } from 'react';
import { mulaiPengirim } from '@/lib/pengirim';

export function PwaDaftar(): React.JSX.Element | null {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Pendaftaran gagal tidak boleh muncul sebagai galat yang menjatuhkan halaman.
      });
    }

    // Pengiriman latar tetap jalan walau staf tidak sedang membuka /catat.
    const berhenti = mulaiPengirim();
    return berhenti;
  }, []);

  return null;
}
