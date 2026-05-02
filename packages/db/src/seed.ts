import 'dotenv/config';
import { db, locations, systemSettings } from './index';

async function seed() {
  console.log('🌱 Seeding initial data...');

  // 3 lokasi fisik Toko Kartini
  await db
    .insert(locations)
    .values([
      {
        id: 'LOC-01',
        code: 'TOKO',
        name: 'Toko Sumedang (Display + Gudang Bahan Makanan)',
        type: 'TOKO',
        address:
          'Jl. R.A. Kartini No.08, RT.001/RW.006, Regol Wetan, Kec. Sumedang Sel., Kab. Sumedang, Jawa Barat 45311',
        distanceKmFromMain: '0',
        isActive: true,
      },
      {
        id: 'LOC-02',
        code: 'GP-TOKO',
        name: 'Gudang Packaging (Toko)',
        type: 'GUDANG',
        address: 'Jl. R.A. Kartini No.08 (gudang terpisah, 1 area dengan toko)',
        distanceKmFromMain: '0',
        isActive: true,
      },
      {
        id: 'LOC-03',
        code: 'GP-CIHERANG',
        name: 'Gudang Packaging Ciherang',
        type: 'GUDANG',
        address: '(akan dilengkapi)',
        distanceKmFromMain: '2',
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  console.log('✓ Locations seeded');

  // Default system settings (threshold SO + Olsera default location)
  await db
    .insert(systemSettings)
    .values([
      {
        key: 'so_threshold_low_pct',
        value: '5',
        description: 'Selisih SO < X% per item: auto-approve saat session di-submit',
        category: 'so',
      },
      {
        key: 'so_threshold_high_pct',
        value: '20',
        description: 'Selisih SO >= X% per item: mandatory re-count, block submit',
        category: 'so',
      },
      {
        key: 'olsera_default_location_id',
        value: 'LOC-01',
        description: 'Default lokasi tujuan SALE_OUT dari Olsera (Toko)',
        category: 'olsera',
      },
    ])
    .onConflictDoNothing();
  console.log('✓ System settings seeded');

  console.log('🌱 Seeding done');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
