# System Architecture Design: Distributed Job Scheduler

This document describes the architectural layout, core design decisions, and reliability protocols of the Distributed Job Scheduler.

---

## 1. Process Separation and Monorepo Overview

To mimic enterprise production setups, the system decouples the **REST Control Plane (Backend)** from the **Execution Plane (Worker Service)**. They run as separate processes and scale independently:

```
                  ┌────────────────────────┐
                  │   Next.js Dashboard    │
                  └───────────┬────────────┘
                              │ HTTP / WS
                              ▼
                  ┌────────────────────────┐
                  │   NestJS Control API   │
                  └───────────┬────────────┘
                              │
                              │ DB Connection
                              ▼
 ┌──────────────┐       ┌───────────┐       ┌──────────────┐
 │ Worker Node  ├──────►│ Postgres  │◄──────┤ Worker Node  │
 │  (Process 1) │       │ Database  │       │  (Process 2) │
 └──────────────┘       └───────────┘       └──────────────┘
```

1. **NestJS Control API (backend)**:
   - Manages schemas, migrations, and seeds.
   - Restricts operations inside tenants (User -> Organization -> Project -> Queue -> Job).
   - Generates metrics graphs and streams WS state changes.
2. **TypeScript Worker Node (worker)**:
   - Polling engine that pulls pending tasks directly from PostgreSQL.
   - Evaluates concurrency, priorities, and schedules.
   - Runs mock execution executors (`SEND_EMAIL`, `GENERATE_REPORT`, `SYNC_DATA`) and streams debug levels.
3. **Next.js Interface (frontend)**:
   - Control console to monitor throughput, logs, configure queue limits, and inspect dead letter queues (DLQ).

---

## 2. Queue Polling & Concurrency Control

Polling runs in a `1-second` tick on each worker process:

1. **Worker Capacity Sweep**: Checks if current running jobs count is below worker `concurrencyLimit`. Calculates available task slots.
2. **Queue Throttling Analysis**: Queries database for all active (`isActive = true`) queues. Group-counts currently `RUNNING` jobs per queue. If a queue's running count is greater than or equal to its `concurrencyLimit`, it is marked saturated and excluded from the poll query.
3. **Priority Dispatch**: Queries database for jobs in non-saturated queues where `status = PENDING` or `status = RETRYING` and `runAt <= NOW()`. Sorted by `priority DESC` (high weights run first) and `runAt ASC` (earlier scheduled run times first).
4. **Atomic Acquisition**: For each candidate job, attempts an atomic database transaction:
   - Verifies the job status remains `PENDING` or `RETRYING`.
   - Checks that queue and worker concurrency slots have not filled since the query tick.
   - Transitions status to `RUNNING` and writes worker ID.

---

## 3. Worker Heartbeats & Failover Recovery

- **Check-in Loop**: Every `5 seconds`, worker processes write telemetry back to the database (`Worker` and `WorkerHeartbeat` tables), reporting current running load, CPU load averages (`os.loadavg`), and RAM memory utilization.
- **Orphan Cleaner Sweep**: A detached background loop (`OrphanRecoveryService` running every `10 seconds`) checks the `Worker` table for instances whose `lastHeartbeatAt` is older than `15 seconds`.
- **Failover Logic**: When a crashed worker is detected:
  1. Marks worker status as `OFFLINE`.
  2. Identifies all jobs stuck in `RUNNING` assigned to that worker ID.
  3. Closes their active `JobExecution` logs as failed due to worker crash.
  4. Resets the `Job` status back to `PENDING` and resets the worker ID to `null` so adjacent workers immediately pick up the task.

---

## 4. Retries, Backoffs, and the Dead Letter Queue (DLQ)

If a task execution throws an exception, the system checks the queue's `RetryPolicy` parameters:

- **Backoff Calculations**:
  - `FIXED`: Waits `policy.backoffMs` before trying again.
  - `LINEAR`: Delay = `attempt * policy.backoffMs`.
  - `EXPONENTIAL`: Delay = `Math.pow(2, attempt - 1) * policy.backoffMs`.
- **Quarantine Transition**: If the fail attempt equals `maxRetries`, the job status is set to `DEAD`. The job details and error stacktrace are written to the `DeadLetterJob` table.
- **DLQ Controls**: The user can view dead jobs, inspect stack traces on the dashboard, and choose to **Retry** (deletes the DLQ record and places the job back to `PENDING`) or **Discard** (deletes the job).
