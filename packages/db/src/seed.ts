import 'dotenv/config';
import { db, locations } from './index';

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
  console.log('🌱 Seeding done');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
