import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateQueueDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  concurrencyLimit?: number;

  @IsBoolean()
  @IsOptional()
  priorityEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID()
  @IsOptional()
  retryPolicyId?: string;
}
