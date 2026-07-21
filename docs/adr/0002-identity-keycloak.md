# ADR 0002 — Self-hosted Keycloak for identity & MFA

Status: Accepted · Date: 2026-07-21

## Context
The system needs OIDC login, TOTP MFA (mandatory for Admin/Planner/Executive,
configurable for Technician), RBAC with 4 roles, session revocation, and a
break-glass path — all with no paid dependency.

## Decision
Use **self-hosted Keycloak** (OIDC + TOTP) as the identity provider. The app
holds only a mirror `User` row (subject id + profile + roles) — **no passwords**.
Authorization is enforced **server-side on every endpoint and object**; hiding UI
controls is never the control. Realm/roles/client are provisioned from
`infra/keycloak/sos-realm.json`.

## Consequences
- MFA, password policy, session management handled by a mature IdP.
- One more service to run/back up; realm export is version-controlled.
- App must validate tokens and re-check RBAC + object ownership on the server for
  each request (separation of duties, e.g. no self-acceptance of repairs).
