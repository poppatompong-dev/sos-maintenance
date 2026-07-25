import type { QueueEntryStatus } from '@/domain/sync/queue';

/**
 * Durable client-side queue for field submissions that couldn't reach the
 * server (doc 08 §Offline PWA: "IndexedDB holds the durable client queue;
 * server is the system of record", ADR 0004). One entry = one full
 * checklist-submission attempt (the mutation envelope for
 * `POST /api/inspections` plus the follow-up work-order transition code) —
 * both replay together on drain. State transitions are decided by the pure
 * `nextQueueState` in `src/domain/sync/queue.ts`; this module only persists.
 */
export interface QueuedSubmission {
  id: string; // = envelope.mutationId, the idempotency key
  workOrderCode: string;
  envelope: unknown;
  status: QueueEntryStatus;
  attempts: number;
  lastError: string | null;
  queuedAt: string;
}

const DB_NAME = 'sos-maintenance-offline';
const DB_VERSION = 1;
const STORE = 'inspection-queue';

export function offlineQueueSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('เปิดคิวออฟไลน์ไม่สำเร็จ'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('เข้าถึงคิวออฟไลน์ไม่สำเร็จ'));
    });
  } finally {
    db.close();
  }
}

export async function enqueueSubmission(entry: {
  id: string;
  workOrderCode: string;
  envelope: unknown;
}): Promise<void> {
  const record: QueuedSubmission = {
    ...entry,
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    queuedAt: new Date().toISOString(),
  };
  await run('readwrite', (store) => store.put(record));
}

export async function listQueue(): Promise<QueuedSubmission[]> {
  return run('readonly', (store) => store.getAll());
}

export async function updateQueueEntry(
  id: string,
  patch: Partial<Pick<QueuedSubmission, 'status' | 'attempts' | 'lastError'>>,
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as QueuedSubmission | undefined;
        if (!existing) {
          resolve();
          return;
        }
        const putReq = store.put({ ...existing, ...patch });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error ?? new Error('อัปเดตคิวออฟไลน์ไม่สำเร็จ'));
      };
      getReq.onerror = () => reject(getReq.error ?? new Error('อ่านคิวออฟไลน์ไม่สำเร็จ'));
    });
  } finally {
    db.close();
  }
}

export async function removeQueueEntry(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id));
}
