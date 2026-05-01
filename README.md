# Toko Kartini — Sistem Operasional

Monorepo untuk semua sistem digital Toko Kartini (CV Kartini Boga Nusantara, Sumedang).

## Tech Stack

- **Monorepo:** Turborepo + pnpm
- **Frontend:** Next.js 15 + React 19 + TypeScript
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Auth:** better-auth + Google OAuth
- **UI:** TailwindCSS v4 + shadcn/ui
- **Master Data Sync:** Google Sheets API (service account)

## Apps

| App              | Path           | Status     | Domain               |
| ---------------- | -------------- | ---------- | -------------------- |
| Stock Opname     | `apps/so`      | 🚧 Phase 1 | so.tokokartini.com   |
| POS              | `apps/pos`     | Planned    | pos.tokokartini.com  |
| ERP / Accounting | `apps/erp`     | Planned    | erp.tokokartini.com  |
| B2B Portal       | `apps/b2b`     | Planned    | b2b.tokokartini.com  |
| Landing          | `apps/landing` | Planned    | tokokartini.com      |

## Quick Start (Local Dev)

```bash
# 1. Start database & redis (via Docker Desktop)
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Setup .env files (copy dari .env.example di tiap package/app)
cp packages/db/.env.example packages/db/.env
cp packages/sheets/.env.example packages/sheets/.env
cp apps/so/.env.local.example apps/so/.env.local
# Edit nilai sesuai kebutuhan (Google OAuth client, service account JSON)

# 4. Migrate database
pnpm db:migrate

# 5. Seed initial data (3 lokasi)
pnpm db:seed

# 6. Sync data dari Google Sheet (setelah master sheet diisi)
pnpm sheets:sync

# 7. Run dev server
pnpm dev
```

App akan jalan di `http://localhost:3010`.

## Local Service Ports

- PostgreSQL: `localhost:5434` (mapped from container 5432)
- Redis: `localhost:6381` (mapped from container 6379)
- apps/so: `http://localhost:3010`

## Struktur Folder

```
toko-kartini/
├── apps/
│   └── so/                # Phase 1: Stock Opname (Next.js 15)
├── packages/
│   ├── db/                # Drizzle schema & client
│   ├── auth/              # better-auth config
│   ├── sheets/            # Google Sheets sync
│   └── ui/                # Shared UI utilities
├── docker-compose.yml     # Local dev stack (Postgres + Redis)
└── turbo.json
```

## Owner

Mote (Nanan) — motekreatif@gmail.com
