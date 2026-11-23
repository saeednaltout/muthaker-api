import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import type { Env } from '../config/env.schema';
import {
  DOWNLOAD_URL_TTL,
  UPLOAD_POLICIES,
  UPLOAD_URL_TTL,
  type UploadKind,
} from './storage.policy';

export interface CreateUploadUrlInput {
  kind: UploadKind;
  /** Logical folder, e.g. `users/<id>/avatar`. A random file name is appended. */
  prefix: string;
  contentType: string;
  size: number;
}

export interface UploadTicket {
  bucket: string;
  key: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
}

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/**
 * S3-compatible storage (MinIO locally, Supabase Storage S3 endpoint in prod).
 * Browsers upload DIRECTLY to storage with presigned PUT URLs — files never pass through
 * the API (Vercel's function body limit is ~4.5 MB).
 * Supabase supports SigV4 presigned URLs, so no Supabase-specific driver is needed.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly buckets: { public: string; private: string };

  constructor(private readonly config: ConfigService<Env, true>) {
    this.s3 = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
      // Supabase/MinIO do not support the newer default checksum headers on presigned PUTs.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.buckets = {
      public: config.get('S3_BUCKET_PUBLIC', { infer: true }),
      private: config.get('S3_BUCKET_PRIVATE', { infer: true }),
    };
  }

  /** Validates the policy and returns a presigned PUT URL bound to type and exact size. */
  async createUploadUrl(input: CreateUploadUrlInput): Promise<UploadTicket> {
    const policy = UPLOAD_POLICIES[input.kind];

    if (!policy.contentTypes.includes(input.contentType)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_CONTENT_TYPE_NOT_ALLOWED,
        'Content type not allowed',
        { allowed: policy.contentTypes },
      );
    }
    if (!Number.isInteger(input.size) || input.size <= 0 || input.size > policy.maxSize) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_FILE_TOO_LARGE,
        'File too large',
        { maxSize: policy.maxSize },
      );
    }

    const bucket = this.buckets[policy.bucket];
    const ext = EXTENSIONS[input.contentType] ?? 'bin';
    const key = `${input.prefix.replace(/^\/+|\/+$/g, '')}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: UPLOAD_URL_TTL,
      signableHeaders: new Set(['content-type', 'content-length']),
    });

    return {
      bucket,
      key,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresIn: UPLOAD_URL_TTL,
    };
  }

  /** Short-lived download URL for private objects. */
  async createDownloadUrl(key: string, bucket: 'public' | 'private' = 'private'): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.buckets[bucket], Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: DOWNLOAD_URL_TTL });
  }

  async delete(key: string, bucket: 'public' | 'private' = 'private'): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: key }));
  }

  /** Public URL of an object in the public bucket (avatars). */
  publicUrl(key: string): string {
    const base: string =
      this.config.get('S3_PUBLIC_BASE_URL', { infer: true }) ??
      this.config.get('S3_ENDPOINT', { infer: true });
    return `${base.replace(/\/+$/, '')}/${this.buckets.public}/${key}`;
  }
}
