# Architecture — Dhaka Tesla Pool

## System Overview

```mermaid
flowchart LR
    subgraph Client
        B[Browser]
    end
    subgraph Frontend
        NX[Next.js App Router<br/>React UI]
    end
    subgraph Backend
        API[Node.js + Express API<br/>Auth / Rides / Pooling / Fare]
    end
    subgraph Data
        DB[(PostgreSQL)]
    end

    B --> NX
    NX -->|REST /api/*| API
    API -->|Prisma ORM| DB
```

## Why this shape

- **Next.js (App Router)** — server-rendered pages for passenger/driver dashboards, file-based routing, easy deployment on free tiers (Vercel).
- **Express** — minimal, well-understood REST layer. No need for GraphQL's flexibility on an MVP with a handful of well-known resources.
- **PostgreSQL** — the domain is fundamentally relational (users → vehicles → rides → pool membership → fares), and we need real constraints (foreign keys, capacity checks, unique indexes) that a document store would push into application code.
- **Prisma** — type-safe queries, migrations tracked in git, decent transaction API (needed for the concurrency problem in Section 14 of the brief).
- **No microservices / queues / Redis** — single Node process is enough for an MVP with a handful of actors. Would revisit at scale (see `docs/scaling-bonus.md`).

## Request flow example (ride pooling)

```mermaid
sequenceDiagram
    participant Nusrat
    participant Rafiq
    participant API as Node API
    participant DB as PostgreSQL

    Nusrat->>API: POST /rides (Banani -> Mohakhali)
    API->>DB: INSERT ride_request (REQUESTED)
    API->>DB: find compatible open pool (none yet)
    API->>DB: create Pool, assign Jashim's Bullet
    API-->>Nusrat: MATCHED, pool_id=P1

    Rafiq->>API: POST /rides (Banani -> Gulshan 1)
    API->>DB: INSERT ride_request (REQUESTED)
    API->>DB: find compatible open pool -> P1 matches (same pickup zone, cluster-compatible destination, seats available)
    API->>DB: BEGIN TRANSACTION: lock pool row, check seats_occupied < capacity, insert pool_membership
    API-->>Rafiq: MATCHED, pool_id=P1 (shared with Nusrat)
```

## Layers & responsibility

| Layer | Responsibility |
|---|---|
| Frontend (Next.js) | Auth forms, ride request form, live status view, driver dashboard, pool view. No business logic — only calls API and renders state. |
| Backend (Express) | All business rules: matching, capacity enforcement, fare calc, state transitions, auth, validation. |
| Database (Postgres) | Source of truth. Constraints (FKs, CHECK on capacity, unique pool_membership) as a second line of defense against bugs in application logic. |
