# Mailroom

Node.js + React email operations console. Existing `email-delivery` / `email-delivery-ui` projects are unchanged.

## Local

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run dev
```

- API: http://localhost:8090
- UI: http://localhost:5173 (proxies `/admin/v1` to the API)
- Bootstrap login: `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (defaults `admin@mailroom.local` / `Admin123`)

Postgres can be configured with `DATABASE_URL` **or** `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

## Railway

One service from this repo (Dockerfile). Attach a PostgreSQL plugin and set:

- `DATABASE_URL` or the `PG*` variables
- `APP_SECRET_KEY` (at least 64 bytes)
- `ADMIN_PUBLIC_BASE_URL` (your public https URL)
- `ADMIN_BOOTSTRAP_*`
- optional `MAIL_*` SMTP

Health check: `GET /actuator/health`
