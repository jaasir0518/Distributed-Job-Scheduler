import { Controller, Post, Body, Get, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('queues')
export class QueuesController {
  constructor(private queuesService: QueuesService) {}

  @Post()
  create(@GetUser('id') userId: string, @Body() dto: CreateQueueDto) {
    return this.queuesService.create(userId, dto);
  }

  @Get()
  findAllForProject(@GetUser('id') userId: string, @Query('projectId') projectId: string) {
    return this.queuesService.findAllForProject(userId, projectId);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') queueId: string) {
    return this.queuesService.findOne(userId, queueId);
  }

  @Patch(':id')
  update(
    @GetUser('id') userId: string,
    @Param('id') queueId: string,
    @Body() dto: UpdateQueueDto,
  ) {
    return this.queuesService.update(userId, queueId, dto);
  }
}
