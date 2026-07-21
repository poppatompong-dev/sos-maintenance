# Security and Operations

## Data policy

เก็บเฉพาะ asset/work/staff/maintenance evidence. ห้ามข้อมูลเหตุ SOS จริง ภาพ/เสียงประชาชน ผู้แจ้ง หรือคดี

## Identity/authz

Keycloak OIDC, secure cookie, TOTP MFA บังคับ Admin/Planner/Executive และ configurable Technician; server RBAC + object auth; separation of duties; session revocation policy; break-glass procedure/audit

## Controls

HTTPS/HSTS readiness, CSP, frame protection, CSRF, SameSite/Secure/HttpOnly, schema validation/output encoding, rate limits, dependency/license/secret scan

## Files

Validate MIME/extension/signature/size; random name; checksum; private storage; authorized download; safe Content-Disposition; no traversal/executable serving

## Audit/retention

Append-only audit login/role/config/template/schedule/work/approval/import/export/correction. No secrets/tokens. Work/evidence retained asset lifetime +5 years; referenced master data soft retire; purge requires approval/audit

## Backup/restore

Daily DB + files to location separate from VPS. RPO <=24h, target RTO <=1 workday. Encrypt/restrict/monitor. Quarterly staging restore drill with integrity/time/owner evidence. Release blocked without tested restore

## Runbooks

Deploy/rollback, secrets/cert rotation, lockout/MFA reset, failed sync/import, stuck job/email, storage full, DB/Keycloak outage, backup failure, restore, security incident, dependency update

## Production gate

No defaults/secrets; HTTPS/MFA/RBAC/files tested; backup fresh/restore passed; alert owner set; migration dry run; license inventory; safe logging
