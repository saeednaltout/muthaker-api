/**
 * Upload policies. Supabase Free: 50 MB max per file, 1 GB total — stay well below.
 * Limits are enforced server-side when presigned URLs are issued (the signed Content-Length
 * and Content-Type must match the actual upload, so the client cannot exceed them).
 */
export const UploadKind = {
  AVATAR: 'AVATAR',
  ATTACHMENT: 'ATTACHMENT',
} as const;
export type UploadKind = (typeof UploadKind)[keyof typeof UploadKind];

export interface UploadPolicy {
  bucket: 'public' | 'private';
  maxSize: number;
  contentTypes: readonly string[];
}

const MB = 1024 * 1024;

export const UPLOAD_POLICIES: Record<UploadKind, UploadPolicy> = {
  // Avatars are resized client-side to WebP before upload.
  AVATAR: {
    bucket: 'public',
    maxSize: 1 * MB,
    contentTypes: ['image/webp', 'image/jpeg', 'image/png'],
  },
  ATTACHMENT: {
    bucket: 'private',
    maxSize: 10 * MB,
    contentTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
};

/** Per-user total storage quota (enforced by features that persist file records). */
export const USER_STORAGE_QUOTA_BYTES = 50 * MB;

/** Presigned URL lifetime in seconds. */
export const UPLOAD_URL_TTL = 5 * 60;
export const DOWNLOAD_URL_TTL = 10 * 60;
