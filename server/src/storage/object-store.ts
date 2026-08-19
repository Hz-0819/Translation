import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";

import type { AppConfig } from "../config.js";

export type StoredObjectMetadata = {
  byteSize: number;
  sha256: string | undefined;
  computedSha256: string;
  mimeType: string | undefined;
};

export interface ObjectStore {
  createUploadUrl(input: {
    objectKey: string;
    mimeType: string;
    sha256: string;
  }): Promise<{ uploadUrl: string; headers: Record<string, string> }>;
  inspectObject(objectKey: string): Promise<StoredObjectMetadata | null>;
  createDownloadUrl(objectKey: string): Promise<string>;
}

export class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfig) {
    this.bucket = config.S3_BUCKET;
    const clientOptions = {
      region: config.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY,
        secretAccessKey: config.S3_SECRET_KEY,
      },
    };
    this.client = new S3Client({ ...clientOptions, endpoint: config.S3_ENDPOINT });
    this.signingClient = new S3Client({
      ...clientOptions,
      endpoint: config.S3_PUBLIC_ENDPOINT ?? config.S3_ENDPOINT,
    });
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })).catch(() => {
          throw error;
        });
      }
    }
  }

  async createUploadUrl(input: {
    objectKey: string;
    mimeType: string;
    sha256: string;
  }) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentType: input.mimeType,
      Metadata: { sha256: input.sha256 },
    });
    const uploadUrl = await getSignedUrl(this.signingClient, command, { expiresIn: 15 * 60 });
    return {
      uploadUrl,
      headers: {
        "content-type": input.mimeType,
      },
    };
  }

  async inspectObject(objectKey: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      const downloaded = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      if (!downloaded.Body) return null;
      const digest = createHash("sha256");
      for await (const chunk of downloaded.Body as AsyncIterable<Uint8Array>) {
        digest.update(chunk);
      }
      return {
        byteSize: result.ContentLength ?? 0,
        sha256: result.Metadata?.sha256,
        computedSha256: digest.digest("hex"),
        mimeType: result.ContentType,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  createDownloadUrl(objectKey: string) {
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: 10 * 60 },
    );
  }

  async deleteObject(objectKey: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
