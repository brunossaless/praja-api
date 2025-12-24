import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, type: user.type };
    const accessToken = await this.jwtService.signAsync(payload);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      type: user.type,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { accessToken, user: safeUser };
  }
}
