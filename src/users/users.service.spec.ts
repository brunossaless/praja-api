import { AppException } from 'src/common/errors/app.exception';
import { ErrorCode } from 'src/common/errors/error-codes';
import { UploadedFile } from 'src/common/storage/uploaded-file';
import { UsersService } from './users.service';

function imageFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    fieldname: 'file',
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('x'),
    ...overrides,
  };
}

async function expectAppException(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((err: AppException) => {
    expect((err.getResponse() as { code: string }).code).toBe(code);
  });
}

describe('UsersService', () => {
  let prisma: { user: { update: jest.Mock } };
  let storage: { upload: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { update: jest.fn().mockResolvedValue({}) } };
    storage = {
      upload: jest.fn().mockResolvedValue('http://host/uploads/avatars/a.png'),
    };
    service = new UsersService(prisma as never, storage as never);
  });

  it('stores the avatar, persists the URL and returns it', async () => {
    const result = await service.uploadAvatar(1, imageFile());

    expect(storage.upload).toHaveBeenCalledWith(expect.anything(), 'avatars');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { avatarUrl: 'http://host/uploads/avatars/a.png' },
    });
    expect(result).toEqual({ url: 'http://host/uploads/avatars/a.png' });
  });

  it('rejects a missing file', async () => {
    await expectAppException(
      service.uploadAvatar(1, undefined),
      ErrorCode.UPLOAD_INVALID_FILE,
    );
  });

  it('rejects a non-image mime type', async () => {
    await expectAppException(
      service.uploadAvatar(1, imageFile({ mimetype: 'application/pdf' })),
      ErrorCode.UPLOAD_INVALID_FILE,
    );
  });

  it('rejects a file larger than 5MB', async () => {
    await expectAppException(
      service.uploadAvatar(1, imageFile({ size: 6 * 1024 * 1024 })),
      ErrorCode.UPLOAD_INVALID_FILE,
    );
  });
});
