import { IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
    @IsString()
    email: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    password: string;

    @IsOptional()
    createdAt?: Date;
}
