import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Storage } from '@google-cloud/storage';

export type TripSheetPdfStorageMode = 'gcs' | 'bytea';

@Injectable()
export class TripSheetPdfStorageService {
  private storage: Storage | null = null;

  bucketName(): string | null {
    const name = process.env.GCS_BUCKET?.trim();
    return name && name.length > 0 ? name : null;
  }

  resolveStorageMode(): TripSheetPdfStorageMode {
    if (this.bucketName()) return 'gcs';
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'GCS_BUCKET is required in production for trip sheet PDF storage',
      );
    }
    return 'bytea';
  }

  objectKey(tenantSlug: string, docId: string): string {
    const safeSlug = tenantSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `tenants/${safeSlug}/trip-sheets/${safeId}.pdf`;
  }

  assertKeyMatchesTenant(tenantSlug: string, storageKey: string): void {
    const expectedPrefix = `tenants/${tenantSlug.replace(/[^a-zA-Z0-9_-]/g, '_')}/trip-sheets/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new NotFoundException('Document not found');
    }
  }

  async upload(tenantSlug: string, docId: string, pdf: Buffer): Promise<string> {
    const bucket = this.bucketName();
    if (!bucket) {
      throw new InternalServerErrorException('GCS bucket not configured');
    }
    const key = this.objectKey(tenantSlug, docId);
    try {
      await this.getStorage()
        .bucket(bucket)
        .file(key)
        .save(pdf, {
          resumable: false,
          contentType: 'application/pdf',
          metadata: { cacheControl: 'private, max-age=0' },
        });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`Failed to upload trip sheet PDF: ${msg}`);
    }
    return key;
  }

  async download(tenantSlug: string, storageKey: string): Promise<Buffer> {
    const bucket = this.bucketName();
    if (!bucket) {
      throw new InternalServerErrorException('GCS bucket not configured');
    }
    this.assertKeyMatchesTenant(tenantSlug, storageKey);
    try {
      const [data] = await this.getStorage().bucket(bucket).file(storageKey).download();
      return Buffer.from(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('No such object') || msg.includes('Not Found')) {
        throw new NotFoundException('PDF not found in storage');
      }
      throw new InternalServerErrorException(`Failed to download trip sheet PDF: ${msg}`);
    }
  }

  private getStorage(): Storage {
    if (!this.storage) {
      this.storage = new Storage();
    }
    return this.storage;
  }
}
