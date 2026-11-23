import { StorageService } from '../src/storage/storage.service';
import { createTestApp, type TestApp } from './helpers/app';

/** Verifies presigned URLs against a real S3 API (MinIO), exactly as the browser will use them. */
describe('StorageService against MinIO (e2e)', () => {
  let t: TestApp;
  let storage: StorageService;

  beforeAll(async () => {
    t = await createTestApp();
    storage = t.app.get(StorageService);
  });
  afterAll(() => t.close());

  it('uploads with a presigned PUT, downloads with a presigned GET, then deletes', async () => {
    const content = Buffer.from('%PDF-1.4 fake test file');
    const ticket = await storage.createUploadUrl({
      kind: 'ATTACHMENT',
      prefix: 'e2e/tests',
      contentType: 'application/pdf',
      size: content.length,
    });

    const put = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: ticket.headers,
      body: content,
    });
    expect(put.status).toBe(200);

    const download = await fetch(await storage.createDownloadUrl(ticket.key));
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).toString()).toBe(content.toString());

    await storage.delete(ticket.key);
    const gone = await fetch(await storage.createDownloadUrl(ticket.key));
    expect(gone.status).toBe(404);
  });

  it('rejects an upload whose size differs from the signed size', async () => {
    const ticket = await storage.createUploadUrl({
      kind: 'ATTACHMENT',
      prefix: 'e2e/tests',
      contentType: 'application/pdf',
      size: 10,
    });
    const put = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: ticket.headers,
      body: Buffer.alloc(2048),
    });
    expect(put.status).toBeGreaterThanOrEqual(400);
  });

  it('private bucket objects are not publicly readable', async () => {
    const content = Buffer.from('secret');
    const ticket = await storage.createUploadUrl({
      kind: 'ATTACHMENT',
      prefix: 'e2e/private',
      contentType: 'application/pdf',
      size: content.length,
    });
    await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: content });
    const anonymous = await fetch(`${process.env.S3_ENDPOINT}/${ticket.bucket}/${ticket.key}`);
    expect(anonymous.status).toBe(403);
    await storage.delete(ticket.key);
  });
});
