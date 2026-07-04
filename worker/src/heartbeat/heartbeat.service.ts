import { prisma } from '../services/db';
import * as os from 'os';
import { WorkerStatus } from '@prisma/client';

export class HeartbeatService {
  private workerId: string | null = null;
  private workerName: string;
  private concurrencyLimit: number;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(workerName: string, concurrencyLimit = 10) {
    this.workerName = workerName;
    this.concurrencyLimit = concurrencyLimit;
  }

  async start() {
    // 1. Register worker
    const worker = await prisma.worker.create({
      data: {
        name: this.workerName,
        concurrencyLimit: this.concurrencyLimit,
        status: WorkerStatus.IDLE,
        lastHeartbeatAt: new Date(),
      },
    });

    this.workerId = worker.id;
    console.log(`Worker registered successfully. ID: ${this.workerId}, Name: ${this.workerName}`);

    // 2. Start heartbeat loop
    this.intervalId = setInterval(() => this.sendHeartbeat(), 5000);
    // Send immediate first heartbeat
    await this.sendHeartbeat();
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.workerId) {
      try {
        await prisma.worker.update({
          where: { id: this.workerId },
          data: { status: WorkerStatus.OFFLINE },
        });
        console.log(`Worker ${this.workerId} marked offline.`);
      } catch (err) {
        console.error(`Failed to mark worker offline on shutdown:`, err);
      }
    }
  }

  getWorkerId() {
    return this.workerId;
  }

  private async sendHeartbeat() {
    if (!this.workerId) return;

    try {
      // Calculate system stats
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsage = parseFloat(((1 - freeMem / totalMem) * 100).toFixed(2));
      const systemLoad = parseFloat(os.loadavg()[0].toFixed(2));

      // Get current running jobs count assigned to this worker
      const runningJobsCount = await prisma.job.count({
        where: {
          workerId: this.workerId,
          status: 'RUNNING',
        },
      });

      const status = runningJobsCount > 0 ? WorkerStatus.BUSY : WorkerStatus.IDLE;

      await prisma.$transaction(async (tx) => {
        // Update worker table
        await tx.worker.update({
          where: { id: this.workerId! },
          data: {
            lastHeartbeatAt: new Date(),
            status,
            currentLoad: runningJobsCount,
          },
        });

        // Add heartbeat log
        await tx.workerHeartbeat.create({
          data: {
            workerId: this.workerId!,
            systemLoad,
            memoryUsage,
          },
        });
      });
    } catch (error) {
      console.error(`Error sending heartbeat for worker ${this.workerId}:`, error);
    }
  }
}
