import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  private async verifyQueueOwnership(userId: string, queueId: string) {
    const queue = await this.prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        project: {
          include: { organization: true },
        },
      },
    });

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    if (queue.project.organization.ownerId !== userId) {
      throw new ForbiddenException('You do not own the project for this queue');
    }

    return queue;
  }

  async create(userId: string, dto: CreateJobDto) {
    await this.verifyQueueOwnership(userId, dto.queueId);

    let runAt = new Date();
    if (dto.delayMs) {
      runAt = new Date(Date.now() + dto.delayMs);
    } else if (dto.runAt) {
      runAt = new Date(dto.runAt);
    }

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          name: dto.name,
          payload: JSON.stringify(dto.payload),
          priority: dto.priority ?? 0,
          queueId: dto.queueId,
          runAt,
          batchId: dto.batchId,
          status: JobStatus.PENDING,
        },
      });

      if (dto.cronExpression || dto.intervalMs) {
        await tx.scheduledJob.create({
          data: {
            jobId: job.id,
            cronExpression: dto.cronExpression,
            intervalMs: dto.intervalMs,
            nextRunAt: runAt,
          },
        });
      }

      return job;
    });
  }

  async findAllForQueue(userId: string, queueId: string, page = 1, limit = 50) {
    await this.verifyQueueOwnership(userId, queueId);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where: { queueId },
        orderBy: [
          { priority: 'desc' },
          { runAt: 'asc' },
        ],
        skip,
        take: limit,
        include: {
          scheduledJob: true,
          deadLetterJob: true,
        },
      }),
      this.prisma.job.count({ where: { queueId } }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        queue: {
          include: {
            project: {
              include: { organization: true },
            },
          },
        },
        executions: {
          orderBy: { startedAt: 'desc' },
        },
        scheduledJob: true,
        deadLetterJob: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.queue.project.organization.ownerId !== userId) {
      throw new ForbiddenException('You do not own the project for this job');
    }

    return job;
  }

  async cancel(userId: string, jobId: string) {
    const job = await this.findOne(userId, jobId); // verifies ownership

    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.RETRYING) {
      throw new BadRequestException(`Cannot cancel a job in status ${job.status}`);
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED },
    });
  }

  async findExecutions(userId: string, jobId: string) {
    await this.findOne(userId, jobId); // verifies ownership

    return this.prisma.jobExecution.findMany({
      where: { jobId },
      orderBy: { startedAt: 'desc' },
      include: {
        worker: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findLogs(userId: string, executionId: string) {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        job: {
          include: {
            queue: {
              include: {
                project: {
                  include: { organization: true },
                },
              },
            },
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException('Job execution not found');
    }

    if (execution.job.queue.project.organization.ownerId !== userId) {
      throw new ForbiddenException('You do not own this job execution');
    }

    return this.prisma.jobLog.findMany({
      where: { executionId },
      orderBy: { timestamp: 'asc' },
    });
  }

  async findDeadLetterJobs(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.organization.ownerId !== userId) throw new ForbiddenException('Unauthorized');

    const queues = await this.prisma.queue.findMany({
      where: { projectId },
      select: { id: true },
    });
    const queueIds = queues.map((q) => q.id);

    return this.prisma.deadLetterJob.findMany({
      where: {
        job: { queueId: { in: queueIds } },
      },
      include: {
        job: {
          include: {
            queue: true,
          },
        },
      },
      orderBy: { failedAt: 'desc' },
    });
  }

  async retryDeadJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        queue: {
          include: {
            project: {
              include: { organization: true },
            },
          },
        },
        deadLetterJob: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');
    if (job.queue.project.organization.ownerId !== userId) throw new ForbiddenException('Unauthorized');
    if (!job.deadLetterJob) throw new BadRequestException('Job is not in Dead Letter Queue');

    return this.prisma.$transaction(async (tx) => {
      await tx.deadLetterJob.delete({
        where: { jobId },
      });

      return tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.PENDING,
          runAt: new Date(),
          workerId: null,
        },
      });
    });
  }

  async deleteDeadJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        queue: {
          include: {
            project: {
              include: { organization: true },
            },
          },
        },
        deadLetterJob: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');
    if (job.queue.project.organization.ownerId !== userId) throw new ForbiddenException('Unauthorized');
    if (!job.deadLetterJob) throw new BadRequestException('Job is not in Dead Letter Queue');

    return this.prisma.job.delete({
      where: { id: jobId },
    });
  }
}
