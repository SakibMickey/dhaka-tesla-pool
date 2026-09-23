# ERD — Dhaka Tesla Pool

```mermaid
erDiagram
    USER ||--o{ RIDE_REQUEST : "makes (as passenger)"
    USER ||--o| VEHICLE : "owns (as driver)"
    VEHICLE ||--o{ POOL : "serves"
    POOL ||--o{ RIDE_REQUEST : "contains"
    RIDE_REQUEST ||--|| FARE : "has"
    RIDE_REQUEST ||--o{ RIDE_STATUS_LOG : "history"

    USER {
        uuid id PK
        string name
        string phone UK
        string email UK
        string password_hash
        enum role "PASSENGER | DRIVER"
        timestamp created_at
    }

    VEHICLE {
        uuid id PK
        uuid driver_id FK
        string label "e.g. Bullet"
        int capacity
        enum status "OFFLINE | ONLINE"
        timestamp created_at
    }

    POOL {
        uuid id PK
        uuid vehicle_id FK
        enum status "OPEN | FULL | IN_PROGRESS | COMPLETED | CANCELLED"
        int seats_occupied
        string pickup_zone
        timestamp created_at
    }

    RIDE_REQUEST {
        uuid id PK
        uuid passenger_id FK
        uuid pool_id FK "nullable until matched"
        string pickup_zone
        string destination_zone
        int seats_requested
        enum status "REQUESTED | MATCHED | DRIVER_ARRIVED | STARTED | COMPLETED | CANCELLED"
        timestamp requested_at
        timestamp updated_at
    }

    FARE {
        uuid id PK
        uuid ride_request_id FK
        int base_fare_poysha
        int distance_charge_poysha
        int pool_discount_poysha
        int total_fare_poysha
        enum payment_method "CASH | TESLAPAY"
        enum payment_status "PENDING | PAID"
    }

    RIDE_STATUS_LOG {
        uuid id PK
        uuid ride_request_id FK
        string from_status
        string to_status
        timestamp changed_at
    }
```

## Key constraints (enforced in DB, not just app code)

- `VEHICLE.capacity` — CHECK (capacity > 0)
- `POOL.seats_occupied <= VEHICLE.capacity` — enforced via transaction (see `docs/concurrency.md`), and a DB CHECK as a second line of defense
- `RIDE_REQUEST.pool_id` — nullable FK; only set once matched
- Unique constraint on (`ride_request_id`) in `FARE` — one fare row per ride
- `USER.phone` and `USER.email` — unique, used for login

## Why these tables and not fewer

- `RIDE_STATUS_LOG` is separate from `RIDE_REQUEST.status` so we keep full history ("hold onto enough history to explain exactly what happened" — Section 2 of the brief) without overloading the ride row itself.
- `FARE` is its own table (not columns on `RIDE_REQUEST`) so each passenger's fare is independently queryable/auditable, and so a pool of 3 requests cleanly has 3 fare rows against 1 pool.
