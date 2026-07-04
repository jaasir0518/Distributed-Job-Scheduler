import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { HeartbeatWorkerDto } from './dto/heartbeat-worker.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('workers')
export class WorkersController {
  constructor(private workersService: WorkersService) {}

  @Post('register')
  register(@Body() dto: RegisterWorkerDto) {
    return this.workersService.register(dto);
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') workerId: string, @Body() dto: HeartbeatWorkerDto) {
    return this.workersService.heartbeat(workerId, dto);
  }

  @Post('cleanup')
  cleanup() {
    return this.workersService.cleanOrphanedWorkers();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.workersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') workerId: string) {
    return this.workersService.findOne(workerId);
  }
}
