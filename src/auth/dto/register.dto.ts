import { UserType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(UserType)
  type: UserType;

  @ValidateIf((o: RegisterDto) => o.type === UserType.WORKER)
  @IsString()
  @MinLength(1)
  profession?: string;

  @ValidateIf((o: RegisterDto) => o.type === UserType.WORKER)
  @IsString()
  @MinLength(11)
  cpf?: string;

  @ValidateIf((o: RegisterDto) => o.type === UserType.WORKER)
  @IsString()
  @MinLength(5)
  rg?: string;

  @IsOptional()
  @IsString()
  certificate?: string;
}
