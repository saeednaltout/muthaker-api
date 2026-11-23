import type { OpenAPIObject } from '@nestjs/swagger';
import Converter from 'openapi-to-postmanv2';

import { deterministicId, sortKeys, stableStringify } from './stable-json';

export const COLLECTION_NAME = 'muthaker';
const API_BASE_PATH = ['api', 'v1'];

type Json = Record<string, unknown>;
interface PostmanItem extends Json {
  name: string;
  item?: PostmanItem[];
  request?: Json & { method?: string; url?: Json; auth?: Json };
  response?: Json[];
  id?: string;
}

/** Collection-level tests: run after every request (smoke checks in newman). */
const COLLECTION_TESTS = [
  "pm.test('status is not a server error', function () {",
  '  pm.expect(pm.response.code).to.be.below(500);',
  '});',
  "pm.test('response time is acceptable', function () {",
  '  pm.expect(pm.response.responseTime).to.be.below(5000);',
  '});',
  "pm.test('response is JSON', function () {",
  '  if (pm.response.code === 204) return;',
  "  pm.expect(pm.response.headers.get('Content-Type') || '').to.include('application/json');",
  '});',
];

function convert(spec: OpenAPIObject): Promise<Json> {
  return new Promise((resolve, reject) => {
    Converter.convert(
      { type: 'json', data: spec },
      {
        folderStrategy: 'Tags',
        parametersResolution: 'Example',
        requestNameSource: 'Fallback',
        indentCharacter: 'Space',
        includeAuthInfoInExample: false,
      },
      (err, result) => {
        if (err) return reject(new Error(err.message));
        const data = result?.output?.[0]?.data as Json | undefined;
        if (!result?.result || !data) {
          return reject(new Error(result?.reason ?? 'Conversion failed'));
        }
        resolve(data);
      },
    );
  });
}

/** Security scheme names per "METHOD /path" from the OpenAPI document. */
function securityIndex(spec: OpenAPIObject): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops as Record<string, { security?: Json[] }>)) {
      const names = (op.security ?? []).flatMap((s) => Object.keys(s));
      index.set(`${method.toUpperCase()} ${path}`, names);
    }
  }
  return index;
}

function normalizeUrl(url: Json): string[] {
  const path = (url.path as string[] | undefined) ?? [];
  const trimmed =
    path[0] === API_BASE_PATH[0] && path[1] === API_BASE_PATH[1] ? path.slice(2) : path;
  url.host = ['{{baseUrl}}'];
  url.path = trimmed;
  const query = (url.query as { key: string; value?: string }[] | undefined) ?? [];
  const qs = query.length ? `?${query.map((q) => `${q.key}=${q.value ?? ''}`).join('&')}` : '';
  url.raw = `{{baseUrl}}/${trimmed.join('/')}${qs}`;
  return trimmed;
}

/**
 * The converter fills free-form objects (`additionalProperties`) with a RANDOM number of
 * `key_0..key_N` placeholders. Collapse them so regeneration never produces a diff.
 */
function stabilizeBody(body: string): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v as Json);
      if (entries.length > 0 && entries.every(([k]) => /^key_\d+$/.test(k))) return {};
      return Object.fromEntries(entries.map(([k, val]) => [k, strip(val)]));
    }
    return v;
  };
  try {
    return JSON.stringify(strip(JSON.parse(body)), null, 2);
  } catch {
    return body;
  }
}

function processItem(item: PostmanItem, security: Map<string, string[]>): PostmanItem {
  if (item.item) {
    item.item = item.item
      .map((child) => processItem(child, security))
      .sort((a, b) => a.name.localeCompare(b.name));
    item.id = deterministicId('folder', item.name);
    return item;
  }

  const request = item.request ?? {};
  const method = String(request.method ?? 'GET');
  const segments = request.url ? normalizeUrl(request.url) : [];
  const openApiPath = `/${[...API_BASE_PATH, ...segments].join('/')}`.replace(
    /\/:([A-Za-z0-9_]+)/g,
    '/{$1}',
  );
  item.id = deterministicId(method, openApiPath);

  const schemes = security.get(`${method} ${openApiPath}`) ?? [];
  if (schemes.includes('cron')) {
    request.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{cronSecret}}', type: 'string' }],
    };
  } else if (schemes.includes('bearer')) {
    request.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    };
  } else {
    // Cookie auth: Postman's cookie jar sends cookies after the Login request.
    delete request.auth;
  }

  item.response = (item.response ?? []).map((res, i) => {
    const r = res;
    r.id = deterministicId(
      method,
      openApiPath,
      'response',
      typeof r.name === 'string' ? r.name : String(i),
    );
    const original = r.originalRequest as { url?: Json } | undefined;
    if (original?.url) normalizeUrl(original.url);
    if (typeof r.body === 'string') r.body = stabilizeBody(r.body);
    return r;
  });
  return item;
}

export async function buildCollection(spec: OpenAPIObject): Promise<Json> {
  const raw = await convert(spec);
  const security = securityIndex(spec);
  const items = ((raw.item as PostmanItem[] | undefined) ?? [])
    .map((i) => processItem(i, security))
    .sort((a, b) => a.name.localeCompare(b.name));

  const info = (raw.info as Json | undefined) ?? {};
  return sortKeys({
    info: {
      _postman_id: deterministicId('collection', COLLECTION_NAME),
      name: COLLECTION_NAME,
      description: info.description ?? '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    event: [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: COLLECTION_TESTS },
      },
    ],
    // baseUrl comes from the selected environment (local / staging).
    variable: [],
  });
}

function environment(name: string, baseUrl: string): Json {
  return {
    id: deterministicId('environment', name),
    name: `${COLLECTION_NAME} – ${name}`,
    values: [
      { key: 'baseUrl', value: baseUrl, type: 'default', enabled: true },
      { key: 'cronSecret', value: '', type: 'secret', enabled: true },
      { key: 'accessToken', value: '', type: 'secret', enabled: true },
    ],
    _postman_variable_scope: 'environment',
  };
}

/** All generated Postman files: relative path → content. No secrets (values are empty). */
export async function buildPostmanFiles(spec: OpenAPIObject): Promise<Record<string, string>> {
  return {
    [`postman/${COLLECTION_NAME}.postman_collection.json`]: stableStringify(
      await buildCollection(spec),
    ),
    'postman/local.postman_environment.json': stableStringify(
      environment('local', 'http://localhost:4000/api/v1'),
    ),
    'postman/staging.postman_environment.json': stableStringify(
      environment('staging', 'https://<staging-api-domain>/api/v1'),
    ),
  };
}
