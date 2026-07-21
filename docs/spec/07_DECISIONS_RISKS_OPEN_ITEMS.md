# Decisions, Risks, Assumptions and Open Inputs

## Confirmed

Internal only; full workflow; 27 go-live together; weekly/monthly/semiannual; 4 readiness states; critical fail DOWN; 7-day grace; 4 roles; PWA offline forms/GPS/photos, map online; >100m reason+flag; repair approval; in-app+email; VPS; daily backup RPO24h; no fixed SLA 90 days; lifetime+5y; OSS/free core; generic core/SOS UI; UI A primary + B technician + C planner calendar; premium/fast/simple/no AI slop

## Field assumptions

Public coordinates are seed only; critical component list may change; CCOC test procedure/contact window must be agreed; existing dashboard export unknown; equipment model/serial/power/network unknown

## Open inputs - not blockers for local dev

Official logo/brand/signature; initial Admin/Planner/Technician/UAT names; holiday/work hours; notification recipients; VPS/domain/SMTP; backup target; real equipment; future API/SNMP. Use config/placeholders; never invent personal data, credentials or hardware facts

## Risks/mitigation

- Unknown hardware/interface -> Initial Survey + neutral adapter + manual/import
- weak network -> offline package/queue/idempotency/status
- false READY -> computed rule/baseline/freshness/snapshots
- duplicates -> mutation IDs/transactions
- complex UI -> role navigation + chosen A/B/C boundaries
- slow map/report -> accessible list + lazy chunks + budgets
- storage growth -> compression/quota/monitor/retention
- Keycloak burden -> runbooks/MFA reset/backup
- OSM limits -> configurable provider/attribution/no offline prefetch
- premature SLA -> 90-day baseline

## Change control

บันทึก date/owner/reason/scope-data-API-test impact/version. Decision ที่กระทบ readiness/security/retention/approval ต้อง Product Owner อนุมัติ
