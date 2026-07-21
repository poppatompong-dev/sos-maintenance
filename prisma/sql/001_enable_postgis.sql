-- PostGIS setup — apply AFTER `prisma migrate deploy/dev` (idempotent).
-- Run via: pnpm db:postgis
--
-- Adds a maintained geography(Point,4326) column derived from lon/lat plus a
-- GiST index, so server-side distance (e.g. the 100 m GPS rule, doc 04) uses
-- true spherical distance. The column is GENERATED from longitude/latitude —
-- application code only ever writes lon/lat; `geog` stays in sync automatically.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "asset"
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED;

CREATE INDEX IF NOT EXISTS asset_geog_gix ON "asset" USING GIST (geog);

ALTER TABLE "location"
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED;

CREATE INDEX IF NOT EXISTS location_geog_gix ON "location" USING GIST (geog);
