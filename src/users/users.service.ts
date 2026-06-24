import { Injectable } from '@nestjs/common';
import { StorageService } from 'src/common/storage/storage.service';
import { UploadedFile } from 'src/common/storage/uploaded-file';
import { AppException } from 'src/common/errors/app.exception';
import { ErrorCode } from 'src/common/errors/error-codes';
import { PrismaService } from 'src/prisma/prisma.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_AVATAR_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Validates and stores an avatar image, persists the URL on the
   * authenticated user and returns it. Field name is `file`.
   */
  async uploadAvatar(
    userId: number,
    file?: UploadedFile,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new AppException(
        ErrorCode.UPLOAD_INVALID_FILE,
        'Envie um arquivo de imagem no campo "file".',
      );
    }

    if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
      throw new AppException(
        ErrorCode.UPLOAD_INVALID_FILE,
        'Formato inválido. Envie uma imagem JPEG, PNG ou WEBP.',
        { mimetype: file.mimetype },
      );
    }

    if (file.size > MAX_AVATAR_BYTES) {
      throw new AppException(
        ErrorCode.UPLOAD_INVALID_FILE,
        'Imagem muito grande. O tamanho máximo é 5MB.',
        { size: file.size, maxBytes: MAX_AVATAR_BYTES },
      );
    }

    const url = await this.storage.upload(file, 'avatars');

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });

    return { url };
  }
}
