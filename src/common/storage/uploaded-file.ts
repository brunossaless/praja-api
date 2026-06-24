/**
 * Minimal shape of a Multer in-memory file. Declared locally so the project
 * does not depend on `@types/multer` just for a couple of fields.
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
