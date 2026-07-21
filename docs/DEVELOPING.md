# Developing across machines (บ้าน ↔ ที่ทำงาน)

This project is built to move between machines. **Git is the single source of
truth** — never copy the working folder via Google Drive / USB. Everything that
isn't in git is regenerated locally on each machine.

## What travels, what doesn't

| Travels via **git** (committed) | Regenerated **per machine** (git-ignored) |
|---|---|
| source, `prisma/`, `docs/`, `infra/`, configs | `node_modules/` → `pnpm install` |
| `pnpm-lock.yaml` (exact versions) | `.next/`, `dist/`, `coverage/` → build/test |
| `.env.example`, `.env.prod.example` | `.env` → `cp .env.example .env` |
| toolchain pins (`.nvmrc`, `packageManager`) | database → `pnpm db:setup` (Docker) |
| | `var/uploads`, `var/backup` |

Because the dev database is just seeded reference data, it is **rebuilt from
`prisma/seed.ts`** on each machine — no data needs to sync.

## Toolchain (identical on both machines)
- **Node 22 LTS** (`.nvmrc`) — `nvm use` if you use nvm
- **pnpm 10.34.5** — pinned via `packageManager`; `corepack enable` makes the
  right version activate automatically
- **Docker Desktop** — for Postgres/PostGIS, Keycloak, dev SMTP
- **git** + **GitHub CLI (`gh`)** signed in

## Setting up a NEW machine (e.g. the work PC tomorrow)
```powershell
# 1. Get the code (clone once). Sign in to gh first if needed: gh auth login
git clone https://github.com/poppatompong-dev/sos-maintenance.git C:\dev\sos-maintenance
cd C:\dev\sos-maintenance

# 2. One-shot bootstrap: checks tools, installs deps, creates .env
pnpm dlx zx ./scripts/bootstrap.ps1    # or just run the steps below
#    manual equivalent:
corepack enable
pnpm install
Copy-Item .env.example .env

# 3. Start backing services + database (needs Docker Desktop running)
docker compose up -d
pnpm db:migrate      # first time on a fresh DB (creates the migration)
pnpm db:postgis
pnpm db:seed

# 4. Run
pnpm dev             # http://localhost:3000
pnpm worker:dev      # separate terminal
```
> `scripts/bootstrap.ps1` does steps 2–3 for you (run it from PowerShell).

## Daily flow (do this every session, both machines)
```powershell
# START of session — pull the latest before working
git pull

# ... develop, run pnpm test / typecheck ...

# END of session — commit & push so the other machine has it
git add -A
git commit -m "..."
git push
```
If you switched schema between machines, run `pnpm db:migrate` after pulling to
apply any new migrations, then `pnpm db:seed` if seed data changed.

## Notes
- `.env` never leaves a machine (git-ignored). It holds **dev placeholders only**;
  recreate it anywhere with `cp .env.example .env`. Real production secrets live
  only in `.env.prod` on the server.
- Keep both machines on Node 22 / pnpm 10 to avoid lockfile churn.
- If `pnpm install` warns about build scripts, they're already allow-listed in
  `pnpm-workspace.yaml` (`pnpm rebuild` if needed).
