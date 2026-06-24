import { UploadedFile } from './uploaded-file';

export const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Provider-agnostic file storage. Implementations persist the file and return
 * a public URL. The concrete provider is chosen in {@link StorageModule}.
 */
export abstract class StorageService {
  abstract upload(file: UploadedFile, folder: string): Promise<string>;
}
