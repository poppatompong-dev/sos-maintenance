# ADR 0011 — Internal no-login deployment mode

Status: Accepted for the current internal deployment · Date: 2026-07-22  
Supersedes the active deployment requirement in [ADR 0002](0002-identity-keycloak.md);
the Keycloak implementation remains available as an optional future mode.

## Context

The owner has decided that the current SOS maintenance deployment is for internal
municipal use and should not require a login screen or Keycloak account. The
previous Keycloak gate caused every production API request to return `401` while
the application had no usable internal identity provider.

## Decision

Use the explicit environment setting `AUTH_MODE=internal` for the current
deployment. In this mode:

- no bearer token, login page, Keycloak issuer, or client secret is required;
- each request runs as one internal operator with all application permissions;
- domain validation, idempotency, readiness computation, version conflicts, and
  workflow state transitions remain active;
- assignment filtering is removed from the technician bootstrap so internal users
  can see the open field work package;
- separation-of-duties is not enforceable without user identity and is therefore
  relaxed only for this explicitly selected mode;
- the deployment must be restricted to a trusted internal/private network. A
  public Vercel URL is not itself an internal security boundary.

`AUTH_MODE=keycloak` remains available for a later protected deployment. The
legacy `AUTH_DEV_BYPASS` remains test-only and is not the internal deployment
mechanism.

## Consequences

- The team can smoke-test and use the API without waiting for Keycloak setup.
- Every reachable caller has full application permissions; public exposure can
  permit unauthorized reads and writes.
- Audit rows can retain workflow evidence, but no real individual identity is
  asserted in internal mode.
- Re-enabling identity later requires setting `AUTH_MODE=keycloak`, provisioning
  Keycloak, and rerunning the authentication/RBAC/UAT gates.
