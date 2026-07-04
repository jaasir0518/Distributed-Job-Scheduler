import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';

@Injectable()
export class QueuesService {
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

  async create(userId: string, dto: CreateQueueDto) {
    await this.verifyProjectOwnership(userId, dto.projectId);

    return this.prisma.queue.create({
      data: {
        name: dto.name,
        description: dto.description,
        concurrencyLimit: dto.concurrencyLimit ?? 5,
        priorityEnabled: dto.priorityEnabled ?? true,
        projectId: dto.projectId,
        retryPolicyId: dto.retryPolicyId,
      },
    });
  }

  async findAllForProject(userId: string, projectId: string) {
    await this.verifyProjectOwnership(userId, projectId);

    return this.prisma.queue.findMany({
      where: { projectId },
      include: {
        retryPolicy: true,
        _count: {
          select: { jobs: true },
        },
      },
    });
  }

  async findOne(userId: string, queueId: string) {
    const queue = await this.prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        project: {
          include: { organization: true },
        },
        retryPolicy: true,
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

  async update(userId: string, queueId: string, dto: UpdateQueueDto) {
    const queue = await this.findOne(userId, queueId); // verifies ownership

    return this.prisma.queue.update({
      where: { id: queueId },
      data: {
        description: dto.description ?? undefined,
        concurrencyLimit: dto.concurrencyLimit ?? undefined,
        priorityEnabled: dto.priorityEnabled ?? undefined,
        isActive: dto.isActive ?? undefined,
        retryPolicyId: dto.retryPolicyId ?? undefined,
      },
    });
  }
}
