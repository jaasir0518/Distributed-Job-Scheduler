import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Post()
  create(@GetUser('id') userId: string, @Body() dto: CreateOrgDto) {
    return this.organizationsService.create(userId, dto);
  }

  @Get()
  findAll(@GetUser('id') userId: string) {
    return this.organizationsService.findAll(userId);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') orgId: string) {
    return this.organizationsService.findOne(userId, orgId);
  }
}
