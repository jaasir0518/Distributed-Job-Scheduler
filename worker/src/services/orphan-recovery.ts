import { prisma } from './db';
import { WorkerStatus, JobStatus, ExecutionStatus, LogLevel } from '@prisma/client';

export class OrphanRecoveryService {
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    this.intervalId = setInterval(() => this.cleanup(), 10000);
    console.log('Orphan Recovery Service started. Interval: 10s');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('Orphan Recovery Service stopped.');
  }

  private async cleanup() {
    const heartbeatTimeout = new Date(Date.now() - 15000); // 15 seconds threshold

    try {
      const deadWorkers = await prisma.worker.findMany({
        where: {
          status: { not: WorkerStatus.OFFLINE },
          lastHeartbeatAt: { lt: heartbeatTimeout },
        },
      });

      if (deadWorkers.length === 0) return;

      console.log(`[Orphan Cleaner] Found ${deadWorkers.length} dead workers. Reclaiming jobs...`);

      await prisma.$transaction(async (tx) => {
        for (const worker of deadWorkers) {
          // 1. Mark worker offline
          await tx.worker.update({
            where: { id: worker.id },
            data: { status: WorkerStatus.OFFLINE, currentLoad: 0 },
          });

          // 2. Find jobs stuck in RUNNING on this worker
          const runningJobs = await tx.job.findMany({
            where: {
              workerId: worker.id,
              status: JobStatus.RUNNING,
            },
            include: {
              executions: {
                where: { status: ExecutionStatus.RUNNING },
                orderBy: { startedAt: 'desc' },
                take: 1,
              },
            },
          });

          for (const job of runningJobs) {
            const activeExecution = job.executions[0];
            if (activeExecution) {
              // 3. Mark execution as failed
              await tx.jobExecution.update({
                where: { id: activeExecution.id },
                data: {
                  status: ExecutionStatus.FAILED,
                  endedAt: new Date(),
                  error: `Worker connection lost. Failed over by OrphanRecoveryService.`,
                },
              });

              await tx.jobLog.create({
                data: {
                  executionId: activeExecution.id,
                  level: LogLevel.ERROR,
                  message: `SYSTEM FAILOVER: Worker connection timed out. Re-queuing job.`,
                },
              });
            }

            // 4. Re-queue
            await tx.job.update({
              where: { id: job.id },
              data: {
                status: JobStatus.PENDING,
                workerId: null,
                runAt: new Date(),
              },
            });

            console.log(`[Orphan Cleaner] Re-queued job ${job.id} from worker ${worker.id}`);
          }
        }
      });
    } catch (error) {
      console.error('[Orphan Cleaner] Error running cleanup:', error);
    }
  }
}
