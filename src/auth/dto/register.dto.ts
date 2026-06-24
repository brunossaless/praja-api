import { Gender, UserType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'O nome deve ser um texto' })
  @MinLength(3, { message: 'O nome deve ter pelo menos 3 caracteres' })
  name: string;

  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @IsString({ message: 'A senha deve ser um texto' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
  password: string;

  @IsEnum(UserType, { message: 'O tipo deve ser WORKER ou USER' })
  type: UserType;

  @ValidateIf((o: RegisterDto) => o.type === UserType.WORKER)
  @IsString({ message: 'A profissão deve ser um texto' })
  @MinLength(1, { message: 'A profissão é obrigatória para trabalhadores' })
  profession?: string;

  @ValidateIf((o: RegisterDto) => o.type === UserType.WORKER)
  @IsString({ message: 'O CPF deve ser um texto' })
  @MinLength(11, { message: 'O CPF deve ter pelo menos 11 caracteres' })
  cpf?: string;

  @ValidateIf((o: RegisterDto) => o.type === UserType.WORKER)
  @IsString({ message: 'O RG deve ser um texto' })
  @MinLength(5, { message: 'O RG deve ter pelo menos 5 caracteres' })
  rg?: string;

  @IsOptional()
  @IsString({ message: 'O certificado deve ser um texto' })
  certificate?: string;

  @IsOptional()
  @IsUrl({}, { message: 'A foto de perfil deve ser uma URL válida' })
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'O gênero deve ser FEMALE, MALE ou OTHER' })
  gender?: Gender;
}
