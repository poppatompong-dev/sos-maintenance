'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { AlertTriangleIcon, ScanIcon } from '@/components/icons';

interface ApiErrorBody {
  message?: string;
  error?: string;
}

async function resolveQrToken(token: string): Promise<string> {
  const res = await fetch(`/api/assets/by-qr/${encodeURIComponent(token)}`, { cache: 'no-store' });
  const body = (await res.json().catch(() => null)) as { code?: string } & ApiErrorBody | null;
  if (!res.ok) {
    throw new Error(body?.message ?? body?.error ?? `ค้นหาไม่สำเร็จ (${res.status})`);
  }
  if (!body?.code) throw new Error('ไม่พบเสาที่ตรงกับ QR นี้');
  return body.code;
}

type CameraState = 'requesting' | 'scanning' | 'resolving' | 'denied' | 'unsupported';

/**
 * Camera-based QR scanner (doc 08 §"สแกน QR เพื่อเปิด asset ที่ถูกต้อง"). Decodes
 * frames locally with jsQR — no video leaves the device. On a decoded token it
 * resolves the asset code server-side (`Asset.qrToken` is the source of truth,
 * never trust the client-decoded string as an asset code directly) and
 * navigates to the asset's detail page. A manual-entry fallback covers devices
 * without a usable camera and keeps this reachable without one (WCAG 2.2 AA).
 */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const resolvingRef = useRef(false);

  const [state, setState] = useState<CameraState>('requesting');
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState('scanning');
        tick();
      } catch {
        if (!cancelled) setState('denied');
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || resolvingRef.current) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code?.data) {
            void handleToken(code.data);
            return;
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    async function handleToken(token: string) {
      resolvingRef.current = true;
      setState('resolving');
      setError(null);
      try {
        const assetCode = await resolveQrToken(token);
        stop();
        router.push(`/assets/${assetCode}`);
      } catch (cause) {
        resolvingRef.current = false;
        setError(cause instanceof Error ? cause.message : 'อ่าน QR ไม่สำเร็จ');
        setState('scanning');
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    function stop() {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [router]);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/assets/${encodeURIComponent(code)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-cover ${state === 'scanning' || state === 'resolving' ? '' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" />
        {state === 'scanning' ? (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" aria-hidden="true" />
        ) : null}
        {state === 'requesting' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
            <ScanIcon size={28} />
            <p className="text-xs">กำลังขอสิทธิ์ใช้กล้อง…</p>
          </div>
        ) : null}
        {state === 'resolving' ? (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2.5 text-center text-xs font-medium text-white"
          >
            พบ QR แล้ว — กำลังค้นหาเสา…
          </div>
        ) : null}
        {state === 'denied' || state === 'unsupported' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
            <AlertTriangleIcon size={26} />
            <p className="text-xs leading-relaxed">
              {state === 'unsupported'
                ? 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับกล้อง'
                : 'เข้าถึงกล้องไม่ได้ — ตรวจสอบสิทธิ์อนุญาตกล้องของเบราว์เซอร์'}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-down-tint px-3 py-2 text-xs text-down-ink">
          {error}
        </p>
      ) : null}

      <form onSubmit={submitManual} className="rounded-xl border border-border bg-surface p-4">
        <label className="block text-xs text-ink" htmlFor="manual-code">
          หรือพิมพ์รหัสเสาด้วยตนเอง
          <input
            id="manual-code"
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="เช่น EP01"
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink uppercase"
          />
        </label>
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="mt-3 min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          ไปที่เสานี้
        </button>
      </form>
    </div>
  );
}
