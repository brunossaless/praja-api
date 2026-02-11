import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(body: RegisterDto) {
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        password: hashedPassword,
        type: body.type,
        profession: body.profession,
        cpf: body.cpf,
        rg: body.rg,
        certificate: body.certificate,
      },
      select: {
        id: true,
        email: true,
        name: true,
        type: true,
        profession: true,
        cpf: true,
        rg: true,
        certificate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const payload = { sub: user.id, email: user.email, type: user.type };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, type: user.type };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        type: user.type,
        profession: user.profession,
        cpf: user.cpf,
        rg: user.rg,
        certificate: user.certificate,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}
