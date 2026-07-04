import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateQueueDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @IsUUID()
  projectId: string;

  @IsUUID()
  @IsOptional()
  retryPolicyId?: string;
}
