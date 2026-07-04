import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    // Verify user owns the organization
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.ownerId !== userId) {
      throw new ForbiddenException('You do not own this organization');
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        organizationId: dto.organizationId,
      },
    });
  }

  async findAllForOrg(userId: string, orgId: string) {
    // Verify user owns organization
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.ownerId !== userId) {
      throw new ForbiddenException('You do not own this organization');
    }

    return this.prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        _count: {
          select: { queues: true },
        },
      },
    });
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: true,
        queues: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.organization.ownerId !== userId) {
      throw new ForbiddenException('You do not own the organization for this project');
    }

    return project;
  }
}
