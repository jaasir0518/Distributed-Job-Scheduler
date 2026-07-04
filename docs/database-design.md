# Database Design & Tuning: Distributed Job Scheduler

This document details the relational structure of our 12 tables and explains the indexing decisions that prevent database locks under heavy scheduling loads.

---

## 1. Relational Entity Schema (12 Tables)

1. **User**: Credentials and timestamps.
2. **Organization**: Scopes resources for multi-tenancy.
3. **Project**: Groups related task queues.
4. **Queue**: Concurrency throttle and priority flags.
5. **RetryPolicy**: Configures retry backoff coefficients.
6. **Job**: Task payloads, priorities, status, and scheduled target dates.
7. **Worker**: Active instances running executor loops.
8. **WorkerHeartbeat**: CPU and memory utilization history.
9. **JobExecution**: Attempts details (durations, outcomes, target worker).
10. **JobLog**: Step-by-step console print logs during task execution.
11. **ScheduledJob**: Cron/interval recurring metadata.
12. **DeadLetterJob**: Quarantined job pointers with stack traces.

---

## 2. Table Indexing & Performance Tuning

To scale database-backed queues, indexes are critical to avoid full-table scans during the worker poll loop (which runs every second).

```prisma
model Job {
  // ...
  @@index([queueId])
  @@index([status])
  @@index([runAt])
  @@index([priority])
}
```

### Explanation of Indexes:

1. **`Job(status, runAt, priority, queueId)`**:
   - **Why**: The worker poll query looks like: `SELECT * FROM Job WHERE status = 'PENDING' AND runAt <= NOW() AND queueId IN (...) ORDER BY priority DESC, runAt ASC`.
   - **Benefit**: Without indexes on `status` and `runAt`, the DB performs a sequential scan of every job in the table. The `status` and `runAt` indexes filter out completed/future jobs instantly. The `priority` and `runAt` indexes optimize sorting (avoiding file-sort in memory).
2. **`WorkerHeartbeat(workerId, timestamp)`**:
   - **Why**: Speeds up cleanup queries that search for workers who missed heartbeats (`timestamp < NOW() - 15s`).
3. **`JobExecution(jobId)` & `JobLog(executionId)`**:
   - **Why**: Allows the dashboard to retrieve attempt histories and stream terminal console logs instantly by using the primary foreign keys.
