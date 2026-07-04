import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsUUID()
  @IsNotEmpty()
  queueId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  delayMs?: number;

  @IsString()
  @IsOptional()
  runAt?: string;

  @IsString()
  @IsOptional()
  cronExpression?: string;

  @IsInt()
  @Min(1000)
  @IsOptional()
  intervalMs?: number;

  @IsString()
  @IsOptional()
  batchId?: string;
}
