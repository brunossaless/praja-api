import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { MIME_EXTENSION, StorageService } from './storage.service';
import { UploadedFile } from './uploaded-file';

/**
 * Dev storage: writes to the local `UPLOAD_DIR` folder, served statically
 * under `/<UPLOAD_DIR>`. Files are ephemeral (lost on redeploy) — use the
 * Supabase implementation in shared environments.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
  private readonly publicBaseUrl = (
    process.env.PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`
  ).replace(/\/$/, '');

  async upload(file: UploadedFile, folder: string): Promise<string> {
    const ext = MIME_EXTENSION[file.mimetype] ?? extname(file.originalname);
    const fileName = `${randomUUID()}${ext}`;
    const relativePath = join(folder, fileName);
    const absoluteDir = join(process.cwd(), this.uploadDir, folder);

    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(join(absoluteDir, fileName), file.buffer);
    this.logger.log(`Stored upload at ${this.uploadDir}/${relativePath}`);

    return `${this.publicBaseUrl}/${this.uploadDir}/${relativePath}`.replace(
      /\\/g,
      '/',
    );
  }
}
