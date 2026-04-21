import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

export type UploadListingPhotoInput = {
  listingId: string;
  originalFileName: string;
  contentType: string;
  content: Buffer;
};

export type StoredListingPhoto = {
  url: string;
  thumbnailUrl: string | null;
};

export abstract class ListingPhotoStorage {
  abstract uploadListingPhoto(
    input: UploadListingPhotoInput,
  ): Promise<StoredListingPhoto>;
}

@Injectable()
export class S3ListingPhotoStorageService implements ListingPhotoStorage {
  private readonly logger = new Logger(S3ListingPhotoStorageService.name);
  private readonly bucket = process.env.S3_BUCKET?.trim();
  private readonly region = process.env.S3_REGION?.trim() || 'us-east-1';
  private readonly endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  private readonly publicBaseUrl =
    process.env.S3_PUBLIC_BASE_URL?.trim() || undefined;
  private readonly forcePathStyle =
    (process.env.S3_FORCE_PATH_STYLE?.trim() || 'true').toLowerCase() !==
    'false';

  private readonly client = new S3Client({
    region: this.region,
    endpoint: this.endpoint,
    forcePathStyle: this.forcePathStyle,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  async uploadListingPhoto(
    input: UploadListingPhotoInput,
  ): Promise<StoredListingPhoto> {
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'Listing photo storage is not configured',
      );
    }

    const key = this.buildObjectKey(input.listingId, input.originalFileName);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.content,
          ContentType: input.contentType,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to upload listing photo for ${input.listingId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to upload listing photo');
    }

    return {
      url: this.buildPublicUrl(key),
      thumbnailUrl: null,
    };
  }

  private buildObjectKey(listingId: string, originalFileName: string): string {
    const fileExtension = extname(originalFileName).toLowerCase();
    const safeExtension = /^[.a-z0-9]+$/.test(fileExtension)
      ? fileExtension
      : '';

    return `listings/${listingId}/${randomUUID()}${safeExtension}`;
  }

  private buildPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
    }

    if (this.endpoint && this.bucket) {
      return `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
