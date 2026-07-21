/**
 * Background worker process (doc 03). Owns recurrence generation, stale/readiness
 * reconciliation, import processing, email retry, report generation and cleanup.
 *
 * V1 scaffold: a persistent scheduler with a job registry. Individual jobs are
 * implemented in later sprints — the loop, logging, and graceful shutdown are
 * real so the process runs as its own container from day one. Job *state* is
 * persisted in PostgreSQL (never an in-memory timer as the only source of truth).
 */
import { prisma } from '../server/db/client';

interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

const MINUTE = 60_000;

const jobs: Job[] = [
  {
    name: 'readiness-reconciliation',
    intervalMs: 5 * MINUTE,
    run: async () => {
      // Placeholder: later this recomputes readiness for assets whose evidence
      // may have expired (grace crossing) and writes ReadinessSnapshots.
      const due = await prisma.asset.count({ where: { retiredAt: null } });
      log(`readiness-reconciliation: ${due} active assets in scope`);
    },
  },
  {
    name: 'email-retry',
    intervalMs: MINUTE,
    run: async () => {
      const pending = await prisma.notification.count({
        where: { status: 'FAILED' },
      });
      if (pending > 0) log(`email-retry: ${pending} failed notifications to retry`);
    },
  },
];

function log(message: string) {
  console.log(
    JSON.stringify({ level: 'info', ts: new Date().toISOString(), worker: message }),
  );
}

const timers: NodeJS.Timeout[] = [];
let shuttingDown = false;

async function safeRun(job: Job) {
  if (shuttingDown) return;
  try {
    await job.run();
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        ts: new Date().toISOString(),
        job: job.name,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

async function shutdown(signal: string) {
  shuttingDown = true;
  log(`received ${signal}, shutting down`);
  timers.forEach((t) => clearInterval(t));
  await prisma.$disconnect();
  process.exit(0);
}

async function start() {
  log('worker starting');
  await prisma.$queryRaw`SELECT 1`; // fail fast if DB is unreachable
  for (const job of jobs) {
    void safeRun(job); // run once on boot
    timers.push(setInterval(() => void safeRun(job), job.intervalMs));
  }
  log(`worker ready with ${jobs.length} jobs`);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch((err) => {
  console.error('worker failed to start:', err);
  process.exit(1);
});
