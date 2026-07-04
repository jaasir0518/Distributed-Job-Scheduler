import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  create(@GetUser('id') userId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  findAllForOrg(@GetUser('id') userId: string, @Query('orgId') orgId: string) {
    return this.projectsService.findAllForOrg(userId, orgId);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') projectId: string) {
    return this.projectsService.findOne(userId, projectId);
  }
}
