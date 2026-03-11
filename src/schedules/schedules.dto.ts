import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ScheduleStatus } from '@prisma/client';

export class CreateScheduleDto {
  @IsInt()
  @Type(() => Number)
  jobId: number;

  @IsString()
  @MinLength(1)
  date: string;

  @IsString()
  @MinLength(1)
  time: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observation?: string;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  time?: string;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  observation?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  responseObservation?: string;
}
