import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class HeartbeatWorkerDto {
  @IsNumber()
  @IsOptional()
  systemLoad?: number;

  @IsNumber()
  @IsOptional()
  memoryUsage?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  currentLoad?: number;
}
