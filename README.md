# 🚀 Distributed Multi-Tenant Job Scheduler

An enterprise-grade, highly reliable **Distributed Job Scheduler** designed with a decoupled architecture. The system separates the **REST Control Plane (NestJS)** from the **Execution Plane (Standalone Worker Pool)** using a secure, high-performance database-backed broker.

---

## 🏗️ System Architecture

The architecture decouples API servers and worker instances to ensure separate process scaling and resilience. 

```mermaid
graph TD
    subgraph Client Panel
        UI[Next.js Dashboard App]
    end

    subgraph Control Plane
        API[NestJS API Control Server]
        WS[Socket.io Gateway]
    end

    subgraph Broker / Storage Plane
        DB[(PostgreSQL DB / Prisma Proxy)]
    end

    subgraph Execution Plane (Worker Pool)
        W1[Standalone Worker 1]
        W2[Standalone Worker 2]
    end

    UI <-->|HTTP REST| API
    UI <-->|WebSocket Telemetry| WS
    API <-->|Prisma ORM| DB
    WS <-->|Prisma ORM| DB
    W1 <-->|DB Broker Polling / Heartbeats| DB
    W2 <-->|DB Broker Polling / Heartbeats| DB
    API -.->|Prisma Trigger Broadcast| WS
```

### Protocol Mechanics
1. **Control API**: Exposes tenant endpoints, manages metadata schemas, and validates user authentication scope (User → Org → Project → Queue → Job).
2. **WebSocket Gateway**: Tracks active jobs, executions, and workers, streaming real-time statistics to the frontend dashboard.
3. **Database Broker**: Handles atomic queries. Job acquisitions are performed inside an atomic transaction using target locks to prevent double-execution across multiple workers.
4. **Execution Plane**: Standalone Node.js/TypeScript processes that poll PostgreSQL, respect queue-level and worker-level concurrency limits, execute tasks (`SEND_EMAIL`, `GENERATE_REPORT`, `SYNC_DATA`), and emit live logs.

---

## 📊 Database Entity Relationship (ER) Schema

The database design consists of **12 relational tables** tuned with composite indexes to avoid table locks during fast worker polling cycles.

```mermaid
erDiagram
    USER {
        string id PK
        string name
        string email UK
        string password
        datetime createdAt
    }
    ORGANIZATION {
        string id PK
        string name
        string ownerId FK
        datetime createdAt
    }
    PROJECT {
        string id PK
        string name
        string description
        string organizationId FK
        datetime createdAt
    }
    QUEUE {
        string id PK
        string name
        string description
        int concurrencyLimit
        boolean priorityEnabled
        boolean isActive
        string projectId FK
        string retryPolicyId FK
        datetime createdAt
    }
    RETRY_POLICY {
        string id PK
        string name
        int maxRetries
        string strategy
        int backoffMs
    }
    JOB {
        string id PK
        string name
        string payload
        string status
        int priority
        string queueId FK
        string retryPolicyId FK
        datetime runAt
        string workerId FK
        datetime createdAt
    }
    WORKER {
        string id PK
        string name
        string status
        int concurrencyLimit
        int currentLoad
        datetime lastHeartbeatAt
    }
    WORKER_HEARTBEAT {
        string id PK
        string workerId FK
        float systemLoad
        float memoryUsage
        datetime timestamp
    }
    JOB_EXECUTION {
        string id PK
        string jobId FK
        string workerId FK
        int attempt
        string status
        datetime startedAt
        datetime endedAt
        string error
        int duration
    }
    JOB_LOG {
        string id PK
        string executionId FK
        string level
        string message
        datetime timestamp
    }
    SCHEDULED_JOB {
        string id PK
        string jobId FK
        string cronExpression
        int intervalMs
        datetime nextRunAt
    }
    DEAD_LETTER_JOB {
        string id PK
        string jobId FK
        datetime failedAt
        string reason
        int retryCount
    }

    USER ||--o{ ORGANIZATION : "owns"
    ORGANIZATION ||--o{ PROJECT : "contains"
    PROJECT ||--o{ QUEUE : "scopes"
    QUEUE ||--o{ JOB : "manages"
    QUEUE }|--o| RETRY_POLICY : "follows"
    RETRY_POLICY ||--o{ JOB : "governs"
    JOB ||--o{ JOB_EXECUTION : "logs"
    WORKER ||--o{ JOB : "hosts"
    WORKER ||--o{ WORKER_HEARTBEAT : "reports"
    WORKER ||--o{ JOB_EXECUTION : "performs"
    JOB_EXECUTION ||--o{ JOB_LOG : "records"
    JOB ||--o| SCHEDULED_JOB : "recurs"
    JOB ||--o| DEAD_LETTER_JOB : "quarantines"
```

---

## ✨ Features Checklist

*   **🔒 Secure Tenant Isolation**: User login, automated default workspace generation (Organization & Project scopes).
*   **⚙️ Decoupled Execution Plane**: Standalone workers execute jobs concurrently and report telemetry back to the broker.
*   **💓 Live Heartbeat Monitoring**: Workers register check-ins every 5s, displaying active CPU and Memory stats on the UI.
*   **🛠️ Crash Failover Sweeper**: Background loop reclaims active running tasks from offline workers (inactive for >15s) and moves them back to `PENDING` to prevent job losses.
*   **🚀 Priority-weighted Dispatch**: High priority jobs are selected for execution before lower priority jobs.
*   **⏸️ Queue Pausing & Resuming**: Pause queues from the dashboard. Jobs will remain in `PENDING` state until the queue is resumed.
*   **📈 Real-time WebSockets Telemetry**: Updates dashboard throughput, job statuses, and active worker nodes in real-time.
*   **🔄 Configurable Backoff Retries**: Supports `FIXED`, `LINEAR`, and `EXPONENTIAL` delay calculations when execution fails.
*   **🛡️ Dead Letter Queue (DLQ)**: Quarantines failed jobs after exhaustion of max retries. View stack traces, and manually choose to **Retry** (re-queue) or **Discard** (delete) them.
*   **📝 Step-level Console Log Streaming**: Emits detailed step execution print logs (`INFO`, `WARN`, `ERROR`, `DEBUG`) and displays them in a terminal console reader on the UI.
*   **🐳 Docker Integration**: Complete multi-container environment configurations.

---

## 🐳 Docker Instructions

Follow these instructions to run the entire system (Database, Backend, Worker, Frontend) inside Docker containers.

### Prerequisites
Make sure you have **Docker** and **Docker Compose** installed:
*   **Ubuntu/Debian**: `sudo apt install docker.io docker-compose`
*   **Arch Linux**: `sudo pacman -S docker docker-compose`
*   **macOS / Windows**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Ensure the Docker daemon is running:
```bash
# Start and enable Docker on Linux
sudo systemctl start docker
sudo systemctl enable docker
```

### Launching the Stack
Run the following commands in the project root:

1. **Spin down previous volumes (Clean reset)**:
   ```bash
   docker compose down -v
   ```
2. **Build and launch the services**:
   ```bash
   docker compose up --build
   ```
3. **Verify running containers**:
   ```bash
   docker ps
   ```
   *   **Frontend**: accessible at `http://localhost:3001`
   *   **Backend Control API**: accessible at `http://localhost:3000`

---

## ⚙️ Environment Variables

### 1. Control Plane (Backend) - `backend/.env`
| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL DB Connection URL | `postgresql://postgres:password@localhost:5432/distributed_scheduler` |
| `JWT_SECRET` | Secret key for JWT signatures | `superSecretJwtKeyForAuthentication` |
| `JWT_EXPIRATION` | Expiry duration for authentication JWTs | `1d` |
| `PORT` | NestJS REST & WebSocket server port | `3000` |

### 2. Standalone Execution Plane (Worker) - `worker/.env`
| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL DB Connection URL | `postgresql://postgres:password@localhost:5432/distributed_scheduler` |
| `WORKER_NAME` | Unique identification for the worker | `main-worker-instance` |
| `WORKER_CONCURRENCY` | Maximum concurrent job capacity of the worker | `10` |

### 3. Frontend App (Next.js) - `frontend/.env.local`
| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | URL targeting the Control API | `http://localhost:3000` |

---

## 📍 API Documentation

### Authentication (`/auth`)
*   `POST /auth/register` - Create user account (returns user object + default org/project setup)
*   `POST /auth/login` - Authenticate credentials (returns JWT token)
*   `GET /auth/profile` - Fetch profile metadata containing orgs, projects, and queues.

### Queues (`/queues`)
*   `POST /queues` - Create queue (requires `projectId`, `name`, `concurrencyLimit`, `priorityEnabled`)
*   `GET /queues` - List queues filtered by project ID
*   `PATCH /queues/:id` - Modify queue settings
*   `PATCH /queues/:id/pause` - Temporarily halt job acquisition on a queue
*   `PATCH /queues/:id/resume` - Resume job acquisition

### Jobs (`/jobs`)
*   `POST /jobs` - Enqueue task payload (requires `name`, `payload`, `queueId`, optional `priority`, `runAt`)
*   `GET /jobs` - List jobs with page/limit pagination
*   `GET /jobs/:id` - Fetch job metadata and execution histories
*   `GET /jobs/:id/executions` - Fetch execution attempts for a job
*   `GET /jobs/executions/:executionId/logs` - Fetch execution step-by-step console logs
*   `GET /jobs/dlq` - List quarantined dead jobs
*   `POST /jobs/dlq/:id/retry` - Manually retry a quarantined job
*   `DELETE /jobs/dlq/:id` - Permanently discard a quarantined job

---

## 🧪 Verification & Testing Section

We have created specialized automated end-to-end integration and load-balancing test suites.

### 1. Build Verification
Verify that all services compile with no errors:
```bash
# Backend Build
cd backend
npm run build

# Worker Build
cd ../worker
npm run build

# Frontend Build
cd ../frontend
npm run build
```

### 2. Running the E2E Integration Suite
The E2E suite registers a test user, fetches workspace data, creates a queue, dispatches successful/failing jobs, verifies exponential retry timelines, monitors DLQ transitions, and queries dashboard throughput counters.

Ensure the database proxy is running (or docker-compose databases are live) and the backend/worker are active, then run:
```bash
cd worker
npm run test:e2e
```

### 3. Running the Multi-Worker Load Balancing Test
Verify that concurrent worker polling handles large job pools atomically, processes every task exactly once, and avoids double-execution:

1. Spin up the backend API control plane.
2. Spin up two separate worker instances:
   *   **Worker 1**: `WORKER_NAME=worker-01 npm start`
   *   **Worker 2**: `WORKER_NAME=worker-02 npm start`
3. Dispatch the load-balancer test script:
   ```bash
   cd worker
   npm run test:load-balancing
   ```
4. View the printed reports showing processing distribution percentages per worker and verification of duplicate check counters.
