export function formatRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) return '-';
  return num.toLocaleString('id-ID');
}

// Worker selalu berjalan di UTC. Toko cuma ada di satu zona waktu, jadi
// pergeserannya tetap +7 dan tidak perlu basis data zona waktu — yang di
// Workers memang tidak selalu ada.
export function formatWaktuWIB(iso: string | null | undefined): string {
  if (!iso) return '-';
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) return '-';
  const wib = new Date(waktu.getTime() + 7 * 60 * 60 * 1000);
  const dua = (n: number) => String(n).padStart(2, '0');
  return `${dua(wib.getUTCDate())}/${dua(wib.getUTCMonth() + 1)}/${wib.getUTCFullYear()} ${dua(wib.getUTCHours())}.${dua(wib.getUTCMinutes())} WIB`;
}
