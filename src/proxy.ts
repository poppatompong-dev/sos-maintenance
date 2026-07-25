import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Free, code-level access gate for AUTH_MODE=internal (doc: "the deployed URL
 * must be restricted... or the exposure must be explicitly accepted"). Vercel's
 * own Deployment Protection needs a paid Pro plan to cover the production
 * domain — this achieves the same practical effect (a shared password) for
 * free, entirely inside the app. Standard HTTP Basic Auth so the browser
 * handles the credential prompt natively; no login page to build.
 *
 * `SITE_ACCESS_PASSWORD` unset → allow through in local dev (`NODE_ENV !==
 * 'production'`, so `pnpm dev` needs no extra setup), but **fail closed** in
 * any deployed build — a missing password never means "wide open."
 */
const REALM = 'SOS Maintenance';

function unauthorized(message: string): NextResponse {
  return new NextResponse(message, {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}"`, 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function proxy(request: NextRequest): NextResponse | undefined {
  const password = process.env.SITE_ACCESS_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('ระบบยังไม่ได้ตั้งค่ารหัสผ่านเข้าใช้งาน (SITE_ACCESS_PASSWORD)', { status: 503 });
    }
    return undefined;
  }

  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Basic ')) {
    return unauthorized('ต้องใส่รหัสผ่านเพื่อเข้าใช้งานระบบ');
  }

  let provided: string;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
    provided = decoded.slice(decoded.indexOf(':') + 1);
  } catch {
    return unauthorized('รูปแบบข้อมูลยืนยันตัวตนไม่ถูกต้อง');
  }

  if (provided !== password) {
    return unauthorized('รหัสผ่านไม่ถูกต้อง');
  }

  return undefined;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
