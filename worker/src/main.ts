import { HeartbeatService } from './heartbeat/heartbeat.service';
import { QueuePoller } from './scheduler/queue-poller';
import { TaskExecutor } from './executor/task-executor';
import { OrphanRecoveryService } from './services/orphan-recovery';
import { prisma } from './services/db';

async function main() {
  const workerName = process.env.WORKER_NAME || `Worker-${Math.floor(Math.random() * 1000)}`;
  const concurrencyLimit = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

  console.log(`Starting Job Scheduler Worker: ${workerName}`);

  // 1. Initialize Heartbeat
  const heartbeatService = new HeartbeatService(workerName, concurrencyLimit);
  await heartbeatService.start();

  const workerId = heartbeatService.getWorkerId();
  if (!workerId) {
    console.error('Failed to retrieve worker ID. Exiting...');
    process.exit(1);
  }

  // 2. Initialize Executor
  const executor = new TaskExecutor(workerId);

  // 3. Initialize Poller
  const poller = new QueuePoller(workerId, (job) => executor.executeJob(job));
  poller.start();

  // 4. Initialize Orphan Recovery (runs every 10s)
  const recoveryService = new OrphanRecoveryService();
  recoveryService.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down worker gracefully...`);
    poller.stop();
    recoveryService.stop();
    await heartbeatService.stop();
    await prisma.$disconnect();
    console.log('Worker shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error during worker boot:', err);
  process.exit(1);
});
