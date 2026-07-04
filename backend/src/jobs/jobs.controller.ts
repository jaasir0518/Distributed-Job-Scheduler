import { Controller, Post, Body, Get, Param, Query, Patch, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post()
  create(@GetUser('id') userId: string, @Body() dto: CreateJobDto) {
    return this.jobsService.create(userId, dto);
  }

  @Get()
  findAllForQueue(
    @GetUser('id') userId: string,
    @Query('queueId') queueId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.jobsService.findAllForQueue(userId, queueId, page, limit);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') jobId: string) {
    return this.jobsService.findOne(userId, jobId);
  }

  @Patch(':id/cancel')
  cancel(@GetUser('id') userId: string, @Param('id') jobId: string) {
    return this.jobsService.cancel(userId, jobId);
  }

  @Get(':id/executions')
  findExecutions(@GetUser('id') userId: string, @Param('id') jobId: string) {
    return this.jobsService.findExecutions(userId, jobId);
  }

  @Get('executions/:executionId/logs')
  findLogs(@GetUser('id') userId: string, @Param('executionId') executionId: string) {
    return this.jobsService.findLogs(userId, executionId);
  }

  @Get('dlq')
  findDeadLetterJobs(@GetUser('id') userId: string, @Query('projectId') projectId: string) {
    return this.jobsService.findDeadLetterJobs(userId, projectId);
  }

  @Post('dlq/:id/retry')
  retryDeadJob(@GetUser('id') userId: string, @Param('id') jobId: string) {
    return this.jobsService.retryDeadJob(userId, jobId);
  }

  @Patch('dlq/:id')
  deleteDeadJob(@GetUser('id') userId: string, @Param('id') jobId: string) {
    return this.jobsService.deleteDeadJob(userId, jobId);
  }
}
