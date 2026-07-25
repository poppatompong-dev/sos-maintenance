/**
 * Storage driver interface (ADR 0005): access files only by opaque key, never
 * a client-supplied path. Swapping the V1 local-volume driver for a
 * self-hosted S3-compatible one later is a driver change, not a domain change.
 */
export interface StoragePort {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
