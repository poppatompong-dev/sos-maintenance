import { ZodError } from 'zod';
import { ForbiddenError } from '@/domain/authz/policy';
import { UnauthenticatedError } from '@/server/auth/session';
import { InspectionError } from '@/server/services/submit-inspection';

/** JSON response helper for route handlers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** HTTP status for a domain InspectionError code. */
function inspectionStatus(code: string): number {
  switch (code) {
    case 'ASSET_NOT_FOUND':
    case 'WORKORDER_NOT_FOUND':
    case 'ITEM_NOT_FOUND':
      return 404;
    case 'INVALID_ENVELOPE':
    case 'NO_CHECKLIST_VERSION':
      return 400;
    default:
      return 409; // conflict / unprocessable domain state
  }
}

/** Map any thrown error to a safe JSON HTTP response (no internals leaked). */
export function errorResponse(err: unknown): Response {
  if (err instanceof UnauthenticatedError) {
    return json({ error: 'UNAUTHENTICATED', message: err.message }, 401);
  }
  if (err instanceof ForbiddenError) {
    return json(
      { error: 'FORBIDDEN', message: err.message, permission: err.permission },
      403,
    );
  }
  if (err instanceof ZodError) {
    return json({ error: 'VALIDATION', issues: err.issues }, 400);
  }
  if (err instanceof InspectionError) {
    return json({ error: err.code, message: err.message }, inspectionStatus(err.code));
  }
  console.error('[api] unhandled error:', err);
  return json({ error: 'INTERNAL', message: 'เกิดข้อผิดพลาดภายในระบบ' }, 500);
}
