// Service worker untuk Gudang Toko Kartini.
// Naikkan angka ini tiap kali isi cache berubah — nama cache lama otomatis
// dibuang saat activate, jadi staf tidak pernah nyangkut di versi basi.
const VERSI = 'kartini-v1';
const CACHE_HALAMAN = `${VERSI}-halaman`;
const CACHE_STATIS = `${VERSI}-statis`;

// Halaman offline darurat: cuma dipakai kalau navigasi gagal DAN belum ada
// salinan cache sama sekali (mis. buka aplikasi pertama kali tanpa sinyal).
const HTML_BELUM_DIBUKA = `<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><title>Belum bisa dibuka</title></head>
<body>
  <h1>Halaman ini belum pernah dibuka</h1>
  <p>Sinyal internet sedang tidak ada, dan halaman ini belum pernah tersimpan di perangkat. Coba lagi saat sinyal kembali.</p>
</body>
</html>`;

// skipWaiting supaya versi baru langsung aktif tanpa nunggu semua tab lama
// ditutup — staf gudang jarang menutup tab, jadi kalau menunggu, update
// service worker bisa tidak pernah jalan.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Buang semua cache yang bukan milik versi sekarang. Kalau tidak dibuang,
// cache lama menumpuk selamanya dan bisa menyimpan jawaban basi.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const namaCache = await caches.keys();
        await Promise.all(
          namaCache
            .filter((nama) => nama !== CACHE_HALAMAN && nama !== CACHE_STATIS)
            .map((nama) => caches.delete(nama))
        );
      } catch (err) {
        // Gagal beres-beres cache bukan alasan bikin activate gagal total.
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Endpoint /api/ tidak pernah disentuh service worker. Pencatatan dan
  // sesi login lewat jalur ini — kalau sempat kena cache, staf bisa
  // mengira sebuah baris sudah terkirim padahal sebenarnya tidak.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cuma GET yang dipertimbangkan. Method lain (POST/PUT/DELETE) selalu
  // mengubah data di server, tidak boleh pernah dijawab dari cache.
  if (request.method !== 'GET') {
    return;
  }

  // Aset build Next.js (nama berkasnya mengandung hash) tidak pernah
  // berubah isinya untuk URL yang sama, jadi aman dipakai cache-first —
  // ambil dari cache dulu, baru ke jaringan kalau belum ada.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_STATIS);
          const tersimpan = await cache.match(request);
          if (tersimpan) return tersimpan;
          const respons = await fetch(request);
          try {
            if (respons && respons.status === 200) {
              await cache.put(request, respons.clone());
            }
          } catch (err) {
            // Kuota penyimpanan bisa penuh — biarkan responsnya tetap jalan.
          }
          return respons;
        } catch (err) {
          return fetch(request);
        }
      })()
    );
    return;
  }

  // Navigasi halaman pakai network-first: coba jaringan dulu supaya sesi
  // login dan data terbaru selalu akurat. Cache-first akan membuat staf
  // yang sudah logout tetap melihat halaman lama dari cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const respons = await fetch(request);
          // Jawaban navigasi yang bukan 200 (redirect ke halaman masuk,
          // 401, 500) DILARANG disimpan — kalau tersimpan, staf bisa
          // terkunci di halaman masuk sampai cache-nya dibuang manual.
          if (respons && respons.status === 200) {
            try {
              const cache = await caches.open(CACHE_HALAMAN);
              await cache.put(request, respons.clone());
            } catch (err) {
              // Gagal menyimpan bukan alasan gagal menampilkan halaman.
            }
          }
          return respons;
        } catch (err) {
          try {
            const cache = await caches.open(CACHE_HALAMAN);
            const tersimpan = await cache.match(request);
            if (tersimpan) return tersimpan;
          } catch (errCache) {
            // Lanjut ke halaman darurat di bawah kalau cache pun gagal dibaca.
          }
          return new Response(HTML_BELUM_DIBUKA, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      })()
    );
  }
});
