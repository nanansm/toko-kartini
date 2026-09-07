import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Tanpa incrementalCache dengan sengaja. Override KV bawaan menuntut binding
// bernama persis `NEXT_INC_CACHE_KV`; kalau bindingnya tidak ada, cache gagal
// diam-diam dan halaman tetap dirender ulang seolah cache-nya bekerja.
// Aplikasi ini toh dinamis seluruhnya — datanya dari Sheets, tidak ada ISR —
// dan jatah tulis KV gratis (1.000/hari) lebih baik disimpan untuk katalog.
export default defineCloudflareConfig({});
