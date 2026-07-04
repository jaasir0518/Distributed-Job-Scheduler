import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get('dashboard')
  getDashboardStats(
    @GetUser('id') userId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.metricsService.getDashboardStats(userId, projectId);
  }
}
