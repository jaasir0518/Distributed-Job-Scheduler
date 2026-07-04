import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgDto } from './dto/create-org.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrgDto) {
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        ownerId: userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.organization.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });
  }

  async findOne(userId: string, orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        projects: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.ownerId !== userId) {
      throw new ForbiddenException('You do not own this organization');
    }

    return org;
  }
}
