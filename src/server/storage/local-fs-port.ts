import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import type { StoragePort } from './port';

/**
 * V1 storage driver (ADR 0005): a private local volume outside the web root
 * (never under `public/`). `STORAGE_LOCAL_DIR` (`.env.example`) should point
 * outside the repo in production; defaults to `./var/uploads` for local dev.
 * Keys are always server-generated opaque UUID-based names (see
 * `upload-attachment.ts`) — the path-containment check below is defense in
 * depth, not the primary guard.
 */
function baseDir(): string {
  return resolve(process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), 'var', 'uploads'));
}

function resolveKeyPath(key: string): string {
  if (!key || key.includes('\0')) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  const base = baseDir();
  const resolved = normalize(join(base, key));
  const withinBase = resolved === base || resolved.startsWith(base + sep);
  if (!withinBase || isAbsolute(key)) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  return resolved;
}

export function createLocalFsStoragePort(): StoragePort {
  return {
    async put(key, bytes) {
      const path = resolveKeyPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes, { mode: 0o600 });
    },
    async get(key) {
      try {
        return await readFile(resolveKeyPath(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async delete(key) {
      await rm(resolveKeyPath(key), { force: true });
    },
  };
}
