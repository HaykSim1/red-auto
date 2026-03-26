# Zapchast API (NestJS)

## Local development

```bash
cp .env.example .env
# edit DATABASE_URL, JWT_SECRET, …
npm ci
npm run start:dev
```

Health: `GET http://localhost:3000/v1/health`

## Deploy on Railway

1. **New Railway project** → connect this Git repo.
2. Add **PostgreSQL** and create a **Web** service from the same repo.
3. Web service: set **Root Directory** to `api` (monorepo).
4. Link **Postgres** so `DATABASE_URL` is injected.
5. Set variables from [`.env.railway.example`](./.env.railway.example).
6. Deploy: build/start/pre-deploy are defined in [`railway.toml`](./railway.toml).

Full checklist: [docs/deployment-railway.md](../docs/deployment-railway.md).

### After deploy

```bash
cd api && node scripts/smoke-health.mjs https://<your-railway-host>
# or
SMOKE_URL=https://<your-railway-host> npm run smoke:health
```

Then test OTP from the mobile app against the deployed base URL (`/v1`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | `nest build` |
| `npm run start:prod` | `node dist/main` |
| `npm run migration:run` | TypeORM migrations (see `package.json`) |
| `npm run smoke:health` | Verify `/v1/health` on a deployed URL |
