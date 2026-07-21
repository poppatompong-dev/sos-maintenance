# License Inventory

Confirms the mandatory constraint: **no paid/proprietary dependency is required
for core functionality; all core dependencies are free/open-source** (doc 08).

Generated from the installed dependency tree:
```bash
pnpm licenses list --json   # then grouped by SPDX id
```

## Summary (440 packages in the resolved tree)

| License | Packages | Notes |
|---|---:|---|
| MIT | 364 | permissive |
| Apache-2.0 | 29 | permissive (incl. Prisma, TypeScript, sharp) |
| ISC | 19 | permissive |
| BSD-2-Clause | 8 | permissive |
| BSD-3-Clause | 7 | permissive |
| BlueOak-1.0.0 | 5 | permissive |
| MPL-2.0 | 3 | weak-copyleft, file-level; used as-is, no source changes |
| 0BSD | 1 | public-domain-equivalent |
| CC0-1.0 | 1 | public-domain-equivalent |
| CC-BY-4.0 | 1 | `caniuse-lite` data (attribution) |
| Python-2.0 | 1 | permissive (argparse polyfill) |
| Apache-2.0 AND LGPL-3.0-or-later | 1 | `@img/sharp-win32-x64` binary — dynamically linked; optional image lib, not core |

## Assessment
- **No GPL / AGPL / commercial / paid-API dependency** in the core path.
- MPL-2.0 and LGPL are compatible for our usage (no modification / dynamic link).
- Core runtime services (PostgreSQL/PostGIS, Keycloak, Caddy, MapLibre/Leaflet,
  OpenStreetMap tiles, Playwright/Chromium, Nodemailer) are all free/OSS.
- Paid items are **infrastructure only** (VPS, domain, SMTP relay) — not the
  software itself, as permitted by the brief.

> Re-run and refresh this table on every dependency change; a copyleft/paid
> license appearing here is a release blocker (see `.github/workflows/ci.yml`).
