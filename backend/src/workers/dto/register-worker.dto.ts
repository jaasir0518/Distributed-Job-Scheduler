import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RegisterWorkerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  concurrencyLimit?: number;
}
