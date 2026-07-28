'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraIcon, TrashIcon, UploadIcon } from './icons';

export interface PhotoCaptureInputProps {
  label?: string;
  required?: boolean;
  checklistResponseId?: string;
  onPhotoCaptured?: (attachmentId: string, previewUrl: string) => void;
  onPhotoRemoved?: (attachmentId?: string) => void;
}

type Mode = 'idle' | 'camera' | 'uploading' | 'captured' | 'error';

export function PhotoCaptureInput({
  label = 'ถ่ายภาพประกอบการสำรวจ',
  required = false,
  checklistResponseId,
  onPhotoCaptured,
  onPhotoRemoved,
}: PhotoCaptureInputProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Fallback to file input if getUserMedia is not supported
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setMode('camera');

      // Connect video after state transition renders video element
      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
      }, 50);
    } catch {
      // Access denied or camera unavailable -> fallback to file input
      fileInputRef.current?.click();
    }
  }

  async function uploadBlob(blob: Blob, originalName = 'photo.jpg') {
    setMode('uploading');
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', blob, originalName);
    if (checklistResponseId) {
      formData.append('checklistResponseId', checklistResponseId);
    }

    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;

      if (!res.ok || !data?.id) {
        throw new Error(data?.message ?? 'อัปโหลดรูปภาพไม่สำเร็จ');
      }

      const localUrl = URL.createObjectURL(blob);
      setAttachmentId(data.id);
      setPreviewUrl(localUrl);
      setMode('captured');
      onPhotoCaptured?.(data.id, localUrl);
    } catch (err) {
      setMode('error');
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      stopCamera();
    }
  }

  function capturePhotoFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        void uploadBlob(blob, `photo-${Date.now()}.jpg`);
      }
    }, 'image/jpeg', 0.85);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void uploadBlob(file, file.name);
    }
  }

  function handleRemove() {
    stopCamera();
    const oldId = attachmentId;
    setAttachmentId(null);
    setPreviewUrl(null);
    setMode('idle');
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onPhotoRemoved?.(oldId ?? undefined);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">
          {label} {required ? <span className="text-down-ink">*</span> : null}
        </span>
        {mode === 'captured' ? (
          <span className="inline-flex items-center gap-1 font-medium text-ready-ink">
            ✓ อัปโหลดสำเร็จ
          </span>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Mode: Camera Live Stream */}
      {mode === 'camera' ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 px-4">
            <button
              type="button"
              onClick={capturePhotoFromCamera}
              className="flex min-h-[44px] items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white shadow-md active:scale-95"
            >
              <CameraIcon size={18} />
              ถ่ายรูป
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setMode('idle');
              }}
              className="flex min-h-[44px] items-center rounded-full bg-black/60 px-4 text-white"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      {/* Mode: Uploading */}
      {mode === 'uploading' ? (
        <div className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel text-xs text-muted">
          <UploadIcon size={24} className="animate-bounce text-brand" />
          <span className="mt-2 font-medium">กำลังตรวจสอบและอัปโหลดรูปถ่าย…</span>
        </div>
      ) : null}

      {/* Mode: Captured Image Preview */}
      {mode === 'captured' && previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 text-white">
            <span className="text-[0.6875rem]">หลักฐานภาพถ่ายพร้อมแล้ว</span>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="ลบรูปถ่ายนี้"
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-down/80 px-2.5 text-xs text-white hover:bg-down"
            >
              <TrashIcon size={14} />
              ลบ / ถ่ายใหม่
            </button>
          </div>
        </div>
      ) : null}

      {/* Mode: Idle / Default CTA */}
      {mode === 'idle' || mode === 'error' ? (
        <div>
          {errorMsg ? (
            <p role="alert" className="mb-2 rounded-lg bg-down-tint px-3 py-2 text-xs text-down-ink">
              {errorMsg}
            </p>
          ) : null}
          <button
            type="button"
            onClick={startCamera}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-panel px-4 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-surface active:scale-[0.99]"
          >
            <CameraIcon size={18} className="text-brand" />
            ถ่ายรูป / เลือกภาพประกอบ
          </button>
        </div>
      ) : null}
    </div>
  );
}
