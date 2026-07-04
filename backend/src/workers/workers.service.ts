import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { HeartbeatWorkerDto } from './dto/heartbeat-worker.dto';
import { WorkerStatus, JobStatus, ExecutionStatus, LogLevel } from '@prisma/client';

@Injectable()
export class WorkersService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterWorkerDto) {
    return this.prisma.worker.create({
      data: {
        name: dto.name,
        concurrencyLimit: dto.concurrencyLimit ?? 10,
        status: WorkerStatus.IDLE,
        lastHeartbeatAt: new Date(),
      },
    });
  }

  async heartbeat(workerId: string, dto: HeartbeatWorkerDto) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    const currentLoad = dto.currentLoad ?? worker.currentLoad;
    let status = WorkerStatus.IDLE;
    if (currentLoad > 0) {
      status = WorkerStatus.BUSY;
    }

    return this.prisma.$transaction(async (tx) => {
      // Update worker heartbeat and status
      const updatedWorker = await tx.worker.update({
        where: { id: workerId },
        data: {
          lastHeartbeatAt: new Date(),
          status,
          currentLoad,
        },
      });

      // Record system stats in history
      await tx.workerHeartbeat.create({
        data: {
          workerId,
          systemLoad: dto.systemLoad,
          memoryUsage: dto.memoryUsage,
        },
      });

      return updatedWorker;
    });
  }

  async findAll() {
    return this.prisma.worker.findMany({
      orderBy: { lastHeartbeatAt: 'desc' },
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    });
  }

  async findOne(workerId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
        },
        heartbeats: {
          take: 20,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    return worker;
  }

  // Orphan job cleanup loop: Finds workers that missed heartbeats and recovers their jobs
  async cleanOrphanedWorkers() {
    const heartbeatTimeout = new Date(Date.now() - 15000); // 15 seconds threshold

    const deadWorkers = await this.prisma.worker.findMany({
      where: {
        status: { not: WorkerStatus.OFFLINE },
        lastHeartbeatAt: { lt: heartbeatTimeout },
      },
    });

    if (deadWorkers.length === 0) {
      return { recoveredWorkers: 0, recoveredJobs: 0 };
    }

    let recoveredJobsCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const worker of deadWorkers) {
        // 1. Mark worker as offline
        await tx.worker.update({
          where: { id: worker.id },
          data: { status: WorkerStatus.OFFLINE, currentLoad: 0 },
        });

        // 2. Find running jobs assigned to this worker
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
          // 3. Mark running execution as failed due to worker crash
          const activeExecution = job.executions[0];
          if (activeExecution) {
            await tx.jobExecution.update({
              where: { id: activeExecution.id },
              data: {
                status: ExecutionStatus.FAILED,
                endedAt: new Date(),
                error: `Worker '${worker.name}' (${worker.id}) went offline mid-execution.`,
              },
            });

            await tx.jobLog.create({
              data: {
                executionId: activeExecution.id,
                level: LogLevel.ERROR,
                message: `SYSTEM FAILOVER: Worker connection lost. Job execution aborted.`,
              },
            });
          }

          // 4. Re-queue the job back to PENDING
          await tx.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.PENDING,
              workerId: null,
              runAt: new Date(), // run immediately again
            },
          });

          recoveredJobsCount++;
        }
      }
    });

    return {
      recoveredWorkers: deadWorkers.length,
      recoveredJobs: recoveredJobsCount,
    };
  }
}
