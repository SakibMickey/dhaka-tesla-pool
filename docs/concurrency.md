# Concurrency — the last-seat race

## The problem (Section 14 of the brief)

Bullet has 1 seat left. Nusrat and Shirin both hit "confirm" within the same instant. Both requests read `seats_occupied = 2` (capacity 3) and both think there's a free seat.

## MVP-level solution

Use a **database transaction with row-level locking** around the seat-claim, instead of a plain read-then-write:

```sql
BEGIN;
SELECT seats_occupied, capacity FROM pools p
  JOIN vehicles v ON v.id = p.vehicle_id
  WHERE p.id = :poolId FOR UPDATE; -- locks the pool row until COMMIT

-- application checks seats_occupied < capacity here, using the locked value
INSERT INTO pool_membership (...);
UPDATE pools SET seats_occupied = seats_occupied + 1 WHERE id = :poolId;
COMMIT;
```

`FOR UPDATE` (via `prisma.$transaction` with a raw locking query, or Prisma's interactive transactions) makes the second request's `SELECT` **block** until the first transaction commits or rolls back. Whichever request gets there first wins the seat; the second re-reads the now-updated `seats_occupied`, sees the pool is full, and is rejected with a clear "seat no longer available" error — not a silent overbooking.

A DB-level `CHECK (seats_occupied <= capacity)` constraint is added as a second line of defense in case application logic has a bug.

This is tested directly: a test fires two near-simultaneous claim requests at the last seat and asserts exactly one succeeds and the pool never exceeds capacity.

## At larger scale (what would change)

- Move the seat-claim to an **optimistic concurrency** model (version column + compare-and-swap) if lock contention on hot pools becomes a bottleneck, or
- Push matching/claiming through a **single-writer queue per geographic cell** so seat claims for the same pool are naturally serialized without DB-level locks.
- See `docs/scaling-bonus.md` for the fuller 1M-passenger picture.
