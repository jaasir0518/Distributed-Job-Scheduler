import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, WorkerStatus } from '@prisma/client';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  private async verifyProjectOwnership(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.organization.ownerId !== userId) {
      throw new ForbiddenException('You do not own this project');
    }

    return project;
  }

  async getDashboardStats(userId: string, projectId: string) {
    await this.verifyProjectOwnership(userId, projectId);

    // 1. Get all queues in the project
    const queues = await this.prisma.queue.findMany({
      where: { projectId },
      select: { id: true, name: true, concurrencyLimit: true, isActive: true },
    });

    const queueIds = queues.map((q) => q.id);

    // 2. Count jobs by status within these queues
    const jobStatusCounts = await this.prisma.job.groupBy({
      by: ['status'],
      where: { queueId: { in: queueIds } },
      _count: { id: true },
    });

    const stats = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRYING: 0,
      CANCELLED: 0,
      DEAD: 0,
    };

    jobStatusCounts.forEach((group) => {
      stats[group.status] = group._count.id;
    });

    // 3. Get active and offline workers counts
    const workers = await this.prisma.worker.findMany({
      select: { id: true, name: true, status: true, lastHeartbeatAt: true, currentLoad: true, concurrencyLimit: true },
    });

    const workerStats = {
      total: workers.length,
      active: workers.filter((w) => w.status !== WorkerStatus.OFFLINE).length,
      idle: workers.filter((w) => w.status === WorkerStatus.IDLE).length,
      busy: workers.filter((w) => w.status === WorkerStatus.BUSY).length,
      offline: workers.filter((w) => w.status === WorkerStatus.OFFLINE).length,
      workerList: workers,
    };

    // 4. Detailed Queue Metrics
    const queueMetrics = await Promise.all(
      queues.map(async (queue) => {
        const counts = await this.prisma.job.groupBy({
          by: ['status'],
          where: { queueId: queue.id },
          _count: { id: true },
        });

        const qStats = {
          PENDING: 0,
          RUNNING: 0,
          COMPLETED: 0,
          FAILED: 0,
          RETRYING: 0,
          CANCELLED: 0,
          DEAD: 0,
        };

        counts.forEach((group) => {
          qStats[group.status] = group._count.id;
        });

        return {
          id: queue.id,
          name: queue.name,
          concurrencyLimit: queue.concurrencyLimit,
          isActive: queue.isActive,
          stats: qStats,
        };
      }),
    );

    // 5. Historical execution stats (Last 24 hours grouped by hour)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutions = await this.prisma.jobExecution.findMany({
      where: {
        job: { queueId: { in: queueIds } },
        startedAt: { gte: oneDayAgo },
      },
      select: {
        status: true,
        startedAt: true,
      },
    });

    // Bucket into last 24 hours
    const throughput = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      time.setMinutes(0, 0, 0);
      return {
        hour: `${time.getHours()}:00`,
        success: 0,
        failed: 0,
      };
    });

    recentExecutions.forEach((exec) => {
      const execHour = exec.startedAt.getHours();
      const bucket = throughput.find((t) => t.hour === `${execHour}:00`);
      if (bucket) {
        if (exec.status === 'SUCCESS') {
          bucket.success++;
        } else if (exec.status === 'FAILED') {
          bucket.failed++;
        }
      }
    });

    return {
      jobStats: stats,
      workerStats,
      queueMetrics,
      throughput,
    };
  }
}
