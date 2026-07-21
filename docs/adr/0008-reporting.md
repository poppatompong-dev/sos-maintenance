# ADR 0008 — Single metric service for dashboard/PDF/Excel

Status: Accepted · Date: 2026-07-21

## Context
Dashboard, Thai PDF, and Excel must never disagree for the same filter/time
window. Divergent queries are a common source of "the numbers don't match".

## Decision
All three surfaces read from **one metric service** with a single query/definition
per metric. PDF is rendered from an HTML/CSS print template via Playwright/Chromium;
Excel via ExcelJS. Timestamps are stored UTC and rendered to **Asia/Bangkok / พ.ศ.**
at the edge only. Every output records generated-at, filter, and data freshness.

## Consequences
- One place to change a metric definition; consistency by construction.
- Report generation is a worker job (Chromium is heavy).
- พ.ศ./timezone conversion is centralized in the presentation layer.
