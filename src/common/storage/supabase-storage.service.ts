import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { MIME_EXTENSION, StorageService } from './storage.service';
import { UploadedFile } from './uploaded-file';

/**
 * Stores files in Supabase Storage via its REST API (no SDK dependency).
 * Keeps binaries out of Postgres — the DB only holds the returned public URL.
 *
 * Requires a (public) bucket named `SUPABASE_STORAGE_BUCKET` and the project's
 * service-role key. Uploads use the service role, reads use the public URL.
 */
@Injectable()
export class SupabaseStorageService extends StorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly baseUrl = (process.env.SUPABASE_URL ?? '').replace(
    /\/$/,
    '',
  );
  private readonly serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  private readonly bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'avatars';

  async upload(file: UploadedFile, folder: string): Promise<string> {
    const ext = MIME_EXTENSION[file.mimetype] ?? extname(file.originalname);
    const objectPath = `${folder}/${randomUUID()}${ext}`;
    const uploadUrl = `${this.baseUrl}/storage/v1/object/${this.bucket}/${objectPath}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': file.mimetype,
        'cache-control': 'max-age=3600',
        'x-upsert': 'true',
      },
      body: new Uint8Array(file.buffer),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Supabase upload failed (${res.status}): ${detail}`);
      throw new AppException(
        ErrorCode.INTERNAL_ERROR,
        'Não foi possível salvar a imagem. Tente novamente.',
      );
    }

    return `${this.baseUrl}/storage/v1/object/public/${this.bucket}/${objectPath}`;
  }
}
