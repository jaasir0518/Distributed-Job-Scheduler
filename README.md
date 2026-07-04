# Distributed Job Scheduler

An enterprise-grade, multi-tenant **Distributed Job Scheduler** built with **NestJS**, **Prisma**, **PostgreSQL**, **TypeScript**, and **Next.js**.

This project decoupled the API control plane from the worker execution pool, providing robust fault tolerance, scheduling accuracy, and live telemetry tracking.

---

## 🌟 Key Architecture Highlights

1. **Process Isolation**: The Backend Control API and Worker Pool are completely separate processes. They share a database that acts as a secure, high-performance broker.
2. **Crash Failover Recovery**: Worker nodes check in every 5 seconds. If a worker process goes offline (no check-in for 15 seconds), a sweep loop immediately re-claims its active running jobs, fail-logs the crashed execution attempt, and returns the jobs to `PENDING` state to be run by another worker.
3. **Queue Throttling & Priorities**: Worker polling queries respect individual queue concurrency limits, overall worker capacity, and dispatch jobs based on priority weights.
4. **Interactive DLQ Control**: Jobs that fail repeatedly according to their `RetryPolicy` are quarantined in the Dead Letter Queue (DLQ). They can be inspected (viewing stack traces) and manually re-queued or discarded.
5. **Console Log Streaming**: Individual job runs capture console outputs at different log levels (`INFO`, `DEBUG`, `WARN`, `ERROR`), which are rendered in a terminal console viewer on the dashboard.

---

## 🚀 Getting Started

Ensure you have **Node.js (v18+)** and **npm** installed.

### Step 1: Start the Database Proxy

We use **Prisma Postgres** for local dev. Run this inside the `backend` folder to start the local DB engine:
```bash
cd backend
npx prisma dev start default
```

### Step 2: Set Up and Run the Backend API

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Sync the database schema and generate the client:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
3. Start the API server in watch mode:
   ```bash
   npm run start:dev
   ```
   *The backend will boot on `http://localhost:3000`.*

### Step 3: Run the Standalone Worker Service

1. Install dependencies:
   ```bash
   cd ../worker
   npm install
   ```
2. Link the generated Prisma Client:
   ```bash
   npm run generate
   cp -r ../backend/node_modules/@prisma/client node_modules/
   ```
3. Start the worker process:
   ```bash
   npm start
   ```
   *The worker will register itself and start polling for jobs.*

### Step 4: Run the Next.js Dashboard

1. Install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:3000` or `http://localhost:3001` to view the dashboard dashboard.*

---

## 🧪 Verification & Testing Guide

### 1. Account Setup
- Register an account at `/register` and login at `/login`.
- This automatically creates a default project workspace and org.

### 2. Verify Concurrency and Pausing
1. Go to **Queues** page and adjust your queue's max concurrency to `2`.
2. Dispatch `5` jobs at the same time on the **Jobs** page.
3. Note that at most `2` jobs transition to `RUNNING` simultaneously; the remaining wait in `PENDING`.
4. Click **Pause Queue**; dispatch another job. It will sit in `PENDING` until you click **Resume Queue**.

### 3. Verify Heartbeats & Worker Crash Recovery
1. Go to the **Workers** page. You will see your active worker node and its CPU/RAM stats.
2. Dispatch a long-running job (like `GENERATE_REPORT`).
3. While the job is `RUNNING` (visible in jobs details), terminate the worker console process (`Ctrl+C` in the worker terminal).
4. Watch the dashboard: after 15 seconds, the worker status transitions to `OFFLINE`.
5. The job is immediately recovered, its crashed run attempt is logged, and it returns to `PENDING` (or `DEAD` if max retries exceeded).
