# Dhaka Tesla Pool

Share a seat. Split the fare. Survive Dhaka traffic.

> Status: project scaffold. Sections below are filled in as features land — see git history for progress.

## Summary

An MVP ride-pooling app for Dhaka's shared "Tesla" (auto-rickshaw-style) rides. Passengers request rides, compatible requests get pooled onto one driver's vehicle without exceeding seat capacity, and each passenger sees their own fare and status.

## Problem statement

See [`docs/architecture.md`](docs/architecture.md) for the full write-up of the actors (Passenger, Driver/Tesla, Pool) and the flow.

## Features implemented

- [ ] Passenger sign up / sign in
- [ ] Ride request (pickup, destination, seats)
- [ ] Ride matching / pooling
- [ ] Driver online/offline, accept ride
- [ ] Ride status lifecycle
- [ ] Fare calculation (per-passenger)
- [ ] Ride history

_(checklist updated as features merge to `master`)_

## Screenshots / GIFs

_(added once frontend flows are built)_

## Architecture & ERD

- [`docs/architecture.md`](docs/architecture.md) — system diagram, request flow, why this stack
- [`docs/erd.md`](docs/erd.md) — entity relationship diagram, DB constraints
- [`docs/matching-and-fare.md`](docs/matching-and-fare.md) — zones, pooling rule, fare formula, hand-worked example
- [`docs/concurrency.md`](docs/concurrency.md) — the last-seat race condition and how it's handled

## Tech stack

| Layer | Choice | Why (short version — full justification below) |
|---|---|---|
| Frontend | Next.js (App Router) | Routing + SSR out of the box, easy free-tier deploy |
| Backend | Node.js + Express | Minimal REST layer, easy to reason about for an MVP |
| Database | PostgreSQL + Prisma | Relational domain, needs real constraints + transactions |
| Auth | JWT | Stateless, simple to reason about for an MVP scope |

### Justification (Section 7)

_(filled in per choice: what was picked, alternatives considered, why it fits this MVP, what would trigger a switch later)_

## Project structure

```
.
├── backend/          # Express API, Prisma schema + seed
├── frontend/          # Next.js app
├── docs/               # architecture, ERD, matching/fare, concurrency
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local dev outside Docker)

## Local setup

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health

## Migrations & seed data

Migrations run automatically via `docker compose up` (`prisma migrate deploy`). Seed data uses the brief's story cast — Jashim (driver) with vehicle "Bullet" (3 seats), passengers Nusrat, Rafiq, Shirin.

```bash
# inside backend/ for local (non-docker) dev
npx prisma migrate dev
npm run seed
```

## Demo credentials

| Role | Phone | Password |
|---|---|---|
| Driver (Jashim) | 01711000001 | password123 |
| Passenger (Nusrat) | 01711000002 | password123 |
| Passenger (Rafiq) | 01711000003 | password123 |
| Passenger (Shirin) | 01711000004 | password123 |

## Running tests

```bash
cd backend && npm test
```

## Deployment

_(added once deployed — free tier only, per brief Section 6)_

## API overview

_(added as endpoints are built)_

## Key decisions & trade-offs

_(added as they're made — see individual docs/*.md for the reasoning behind matching, fare, and concurrency choices)_

## Known limitations

_(updated as scope is finalized)_

## Next improvements

_(updated as scope is finalized)_

## AI Usage

Tools used, what for, one accepted suggestion, one rejected/changed suggestion and why — filled in as the project progresses (Section 8 of the brief).

## Demo video

_(link added once recorded — max 6 minutes, per Section 13)_
