# ADR 0001 — Modular full-stack monolith on Next.js

Status: Accepted · Date: 2026-07-21

## Context
A 4-role internal system (~27 assets V1) must ship in 8–12 weeks with one small
team, run on a single VPS, and stay maintainable. Microservices would add
operational cost without a scaling need.

## Decision
Build a **modular monolith** on Next.js App Router + TypeScript with explicit
`domain / service / repository` layering and hard module boundaries (Asset,
Survey, Maintenance, Work, Fault/Repair, Readiness, Report, Notification, Import,
Audit). A separate **worker** process handles background jobs. Domain logic is
pure and framework-free (see `src/domain`).

## Consequences
- Single deployable app + one worker; low ops burden, one DB transaction scope.
- Boundaries are enforced by module structure and review, not network calls —
  discipline required to avoid a big ball of mud.
- A module can later be extracted to a service without a domain rewrite because
  the domain layer has no framework/IO dependencies.
