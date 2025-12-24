import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private safeUserSelect = {
    id: true,
    email: true,
    name: true,
    createdAt: true,
    updatedAt: true,
    type: true,
  } as const;

  async createUser(createUser: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUser.password, 10);
    const idCriptografado = await bcrypt.hash(createUser.email, 10);
    return this.prisma.user.create({
      data: {
        email: createUser.email,
        name: createUser.name,
        password: hashedPassword,
        id: parseInt(idCriptografado),
      },
      select: this.safeUserSelect,
    });
  }

  async getUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect,
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
