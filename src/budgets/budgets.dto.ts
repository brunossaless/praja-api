import { BudgetStatus, BudgetType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateBudgetItemDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(0)
  unitAmountCents: number;
}

export class CreateBudgetDto {
  @IsInt()
  @Type(() => Number)
  scheduleId: number;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(BudgetType, { message: 'O tipo deve ser ONE_TIME ou RECURRING' })
  type: BudgetType;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceIntervalMonths?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'O orçamento deve ter pelo menos um item' })
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items: CreateBudgetItemDto[];
}

export class RespondBudgetDto {
  @IsIn([BudgetStatus.ACCEPTED, BudgetStatus.REJECTED], {
    message: 'O status deve ser ACCEPTED ou REJECTED',
  })
  status: BudgetStatus;

  @IsOptional()
  @IsString()
  clientNote?: string;
}
