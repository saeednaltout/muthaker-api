import request from 'supertest';

import { API, createTestApp, type TestApp } from './helpers/app';

describe('Health & error format (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('GET /health → 200 with db up and version', async () => {
    const res = await request(t.server).get(`${API}/health`).expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up', version: expect.any(String) });
  });

  it('echoes a valid x-request-id and generates one otherwise', async () => {
    const res = await request(t.server)
      .get(`${API}/health`)
      .set('x-request-id', 'test-request-1234')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('test-request-1234');

    const res2 = await request(t.server)
      .get(`${API}/health`)
      .set('x-request-id', '<bad id>')
      .expect(200);
    expect(res2.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('unknown route → 404 in the standard error format', async () => {
    const res = await request(t.server).get(`${API}/does-not-exist`).expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: expect.any(String),
      requestId: res.headers['x-request-id'],
    });
  });

  it('unversioned path is not served', async () => {
    await request(t.server).get('/api/health').expect(404);
  });

  it('sets security headers (helmet) and CORS for the web origin', async () => {
    const res = await request(t.server)
      .get(`${API}/health`)
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not allow CORS for other origins', async () => {
    const res = await request(t.server).get(`${API}/health`).set('Origin', 'https://evil.test');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
