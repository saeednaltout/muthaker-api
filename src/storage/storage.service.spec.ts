import { testConfig } from '../../test/unit/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const service = new StorageService(testConfig());

  it('issues a presigned PUT URL bound to content type and size', async () => {
    const ticket = await service.createUploadUrl({
      kind: 'AVATAR',
      prefix: '/users/u1/avatar/',
      contentType: 'image/webp',
      size: 1000,
    });
    expect(ticket.bucket).toBe('avatars');
    expect(ticket.key).toMatch(/^users\/u1\/avatar\/[0-9a-f-]{36}\.webp$/);
    expect(ticket.method).toBe('PUT');
    expect(ticket.headers).toEqual({ 'Content-Type': 'image/webp' });
    const url = new URL(ticket.uploadUrl);
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
  });

  it('uses the private bucket for attachments', async () => {
    const ticket = await service.createUploadUrl({
      kind: 'ATTACHMENT',
      prefix: 'c/1',
      contentType: 'application/pdf',
      size: 5,
    });
    expect(ticket.bucket).toBe('attachments');
    expect(ticket.key).toMatch(/\.pdf$/);
  });

  it('rejects disallowed content types', async () => {
    await expect(
      service.createUploadUrl({
        kind: 'AVATAR',
        prefix: 'x',
        contentType: 'application/pdf',
        size: 10,
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_CONTENT_TYPE_NOT_ALLOWED', status: 400 });
  });

  it.each([0, -1, 1.5, 1024 * 1024 + 1])('rejects invalid/oversized size %p', async (size) => {
    await expect(
      service.createUploadUrl({ kind: 'AVATAR', prefix: 'x', contentType: 'image/png', size }),
    ).rejects.toMatchObject({ code: 'STORAGE_FILE_TOO_LARGE' });
  });

  it('signs download URLs', async () => {
    const url = await service.createDownloadUrl('a/b.pdf');
    expect(url).toContain('/attachments/a/b.pdf');
    expect(url).toContain('X-Amz-Signature=');
  });

  it('builds public URLs from the endpoint or S3_PUBLIC_BASE_URL', () => {
    expect(service.publicUrl('u/1.webp')).toBe('http://localhost:9000/avatars/u/1.webp');
    const supabase = new StorageService(
      testConfig({ S3_PUBLIC_BASE_URL: 'https://ref.supabase.co/storage/v1/object/public/' }),
    );
    expect(supabase.publicUrl('u/1.webp')).toBe(
      'https://ref.supabase.co/storage/v1/object/public/avatars/u/1.webp',
    );
  });
});
