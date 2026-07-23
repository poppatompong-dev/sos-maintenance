# Documentation index

Start with **[RESUME_HERE.md](RESUME_HERE.md)** — it always reflects the current
state and the next step. This page maps everything else.

## For picking the work back up
| Doc | What it's for |
|---|---|
| [RESUME_HERE.md](RESUME_HERE.md) | ▶ Current state, how to run, ordered next steps. Read first. |
| [ROADMAP_CHECKPOINT.md](ROADMAP_CHECKPOINT.md) | สถานะ milestone, หลักฐาน runtime, blocker และงานถัดไปแบบดูได้ทันที |
| [GO_LIVE_HANDOFF.md](GO_LIVE_HANDOFF.md) | แผน 30 นาทีสุดท้ายและ handoff ให้ทีมทำงานต่อหลังเจ้าของกลับบ้าน |
| [ENGINEERING_LOOP.md](ENGINEERING_LOOP.md) | วงรอบพัฒนา ตรวจสอบ review และ recovery ที่ทีมต้องใช้ร่วมกัน |
| [SESSION_HANDOFF_CODEX.md](SESSION_HANDOFF_CODEX.md) | เปิด Codex session ใหม่หรือย้ายบัญชีโดยไม่หลุดบริบท |
| [START_TOMORROW.md](START_TOMORROW.md) | Continue from **another machine**; ready-to-use prompts for each next task. |
| [PORTABLE_USB.md](PORTABLE_USB.md) | Copy the whole project to a **flash drive** and work offline (no git needed). |
| [WORKLOG.md](WORKLOG.md) | Chronological history + why each decision was made. |
| [DEVELOPING.md](DEVELOPING.md) | Multi-machine workflow (git as source of truth, daily habit). |

## For understanding the system
| Doc | What it's for |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the code is organised as built: layers, modules, the readiness pipeline, ports/adapters, how to add a feature. |
| [DESIGN.md](DESIGN.md) | UI design system: tokens, type, status vocabulary, accessibility. |
| [adr/](adr/) | Architecture Decision Records (10) — the load-bearing choices. |
| [LICENSE_INVENTORY.md](LICENSE_INVENTORY.md) | Proof the core stack is free/OSS (no paid dependency). |

## Requirements & source of truth
| Doc | What it's for |
|---|---|
| [spec/](spec/) | The original handoff pack (01–09): PRD, UX, architecture, data/API, security, QA/UAT, decisions, agent prompt, prototype baseline. |
| [../requirements-traceability.csv](../requirements-traceability.csv) | Requirement → design → implementation → test → evidence. |

**Source-of-truth order when things conflict:** `spec/07` (latest decision) >
`spec/01` & `spec/06` (PRD & acceptance) > `spec/03–05` (technical) > `spec/08`
(agent prompt) > prototype (visual reference only).

## Status at a glance
- ✅ Sprint 1 Foundation · ✅ Sprint 2 Domain layer · IN PROGRESS Workflow UI
- Tests: **167 passing**; typecheck / lint / build green locally.
- Next: fix CI pnpm mismatch, verify ephemeral PostGIS integration, then continue UAT.
