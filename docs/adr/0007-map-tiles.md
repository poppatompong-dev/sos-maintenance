# ADR 0007 — Online OSM tiles, configurable, no offline prefetch

Status: Accepted · Date: 2026-07-21

## Context
The control-centre map shows 27 poles by status. Offline map is explicitly out of
scope; OSM usage policy must be respected and no paid map API used.

## Decision
Use **MapLibre/Leaflet with online OpenStreetMap tiles**. Tile URL + attribution
are **configurable** via env (`NEXT_PUBLIC_MAP_TILE_URL`,
`NEXT_PUBLIC_MAP_ATTRIBUTION`). **No offline tile prefetch.** The map chunk is
lazy-loaded and always paired with an accessible list/table fallback. Offline,
technicians still see point/coordinate data and can fill forms — just no basemap.

## Consequences
- Attribution shown; provider swappable without code change.
- Map is never on the critical initial-shell JS budget (lazy).
- Accessibility + performance budgets are met via the list fallback + lazy load.
