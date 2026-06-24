import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsInt()
  @Type(() => Number)
  userId: number;

  @IsOptional()
  @IsBoolean()
  forWomen?: boolean;
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsBoolean()
  forWomen?: boolean;
}
