# ADR 0005 — Private file storage behind a driver abstraction

Status: Accepted · Date: 2026-07-21

## Context
Photos/documents are evidence and must never be publicly reachable. V1 runs on a
VPS volume; later we may move to self-hosted S3-compatible storage without a
domain rewrite.

## Decision
Access files only through a **storage driver interface** (`put/get/delete` by
opaque key). V1 driver = private local volume outside the web root. Files are
validated (MIME/extension/signature/size), given random names, checksummed, and
served **only** through an authorized endpoint with a safe `Content-Disposition`.
No executable serving, no path traversal.

## Consequences
- Swapping to S3-compatible storage is a driver change, not a domain change.
- All download paths go through authz; keys are opaque and unguessable.
- `Attachment` stores `storageKey`, `checksumSha256`, `mimeType`, `sizeBytes`.
