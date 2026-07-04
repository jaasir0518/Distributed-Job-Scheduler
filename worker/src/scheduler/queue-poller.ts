import { prisma } from '../services/db';
import { Job, JobStatus, WorkerStatus } from '@prisma/client';

export class QueuePoller {
  private workerId: string;
  private isPolling = false;
  private intervalId: NodeJS.Timeout | null = null;
  private executeJobCallback: (job: Job) => Promise<void>;

  constructor(workerId: string, executeJobCallback: (job: Job) => Promise<void>) {
    this.workerId = workerId;
    this.executeJobCallback = executeJobCallback;
  }

  start() {
    this.intervalId = setInterval(() => this.poll(), 1000);
    console.log(`Job Poller started. Interval: 1s`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('Job Poller stopped.');
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // 1. Get worker's current load and capacity
      const worker = await prisma.worker.findUnique({
        where: { id: this.workerId },
      });

      if (!worker || worker.status === WorkerStatus.OFFLINE) {
        this.isPolling = false;
        return;
      }

      const availableSlots = worker.concurrencyLimit - worker.currentLoad;
      if (availableSlots <= 0) {
        this.isPolling = false;
        return;
      }

      // 2. Fetch active queues in the system
      const activeQueues = await prisma.queue.findMany({
        where: { isActive: true },
      });

      if (activeQueues.length === 0) {
        this.isPolling = false;
        return;
      }

      // 3. Find which active queues have not reached their concurrency limit
      const runningJobsPerQueue = await prisma.job.groupBy({
        by: ['queueId'],
        where: { status: 'RUNNING' },
        _count: { id: true },
      });

      const nonSaturatedQueueIds: string[] = [];
      for (const queue of activeQueues) {
        const runningJobs = runningJobsPerQueue.find((r) => r.queueId === queue.id);
        const runningCount = runningJobs ? runningJobs._count.id : 0;

        if (runningCount < queue.concurrencyLimit) {
          nonSaturatedQueueIds.push(queue.id);
        }
      }

      if (nonSaturatedQueueIds.length === 0) {
        this.isPolling = false;
        return;
      }

      // 4. Query candidate jobs sorted by priority (desc) and runAt (asc)
      const candidateJobs = await prisma.job.findMany({
        where: {
          queueId: { in: nonSaturatedQueueIds },
          status: { in: [JobStatus.PENDING, JobStatus.RETRYING] },
          runAt: { lte: new Date() },
        },
        orderBy: [
          { priority: 'desc' },
          { runAt: 'asc' },
        ],
        take: availableSlots,
      });

      // 5. Try to acquire each job atomically
      for (const job of candidateJobs) {
        try {
          const acquiredJob = await prisma.$transaction(async (tx) => {
            // Lock job by status verify
            const currentJob = await tx.job.findUnique({
              where: { id: job.id },
              select: { status: true },
            });

            if (!currentJob || (currentJob.status !== JobStatus.PENDING && currentJob.status !== JobStatus.RETRYING)) {
              throw new Error('Job already acquired by another worker');
            }

            // Lock queue concurrency check
            const runningCountInQueue = await tx.job.count({
              where: { queueId: job.queueId, status: JobStatus.RUNNING },
            });

            const queue = await tx.queue.findUnique({
              where: { id: job.queueId },
              select: { concurrencyLimit: true },
            });

            if (!queue || runningCountInQueue >= queue.concurrencyLimit) {
              throw new Error('Queue concurrency limit reached');
            }

            // Lock worker capacity check
            const currentWorker = await tx.worker.findUnique({
              where: { id: this.workerId },
              select: { concurrencyLimit: true, currentLoad: true },
            });

            if (!currentWorker || currentWorker.currentLoad >= currentWorker.concurrencyLimit) {
              throw new Error('Worker concurrency limit reached');
            }

            // Mark job as RUNNING
            const updatedJob = await tx.job.update({
              where: { id: job.id },
              data: {
                status: JobStatus.RUNNING,
                workerId: this.workerId,
              },
            });

            // Update worker load
            await tx.worker.update({
              where: { id: this.workerId },
              data: {
                currentLoad: currentWorker.currentLoad + 1,
                status: WorkerStatus.BUSY,
              },
            });

            return updatedJob;
          });

          console.log(`Acquired job: ${acquiredJob.name} (${acquiredJob.id})`);
          
          // Trigger execution asynchronously
          this.executeJobCallback(acquiredJob).catch((err) => {
            console.error(`Error in background job execution:`, err);
          });
        } catch (error) {
          // If transaction fails (race condition or limit hit), log and move to next
          // console.log(`Skipped candidate job ${job.id}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Error in poller cycle:`, error);
    } finally {
      this.isPolling = false;
    }
  }
}
