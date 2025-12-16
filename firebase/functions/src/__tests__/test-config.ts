import type { AttachmentId, GroupId, UserId } from '@billsplit-wl/shared';
import { Readable } from 'stream';
import { StubStorage } from 'ts-firebase-simulator';
import { ServiceConfig } from '../merge/ServiceConfig';
import type { AttachmentMetadata, AttachmentMetadataResult, AttachmentStreamResult, GroupAttachmentStorage } from '../services/storage/GroupAttachmentStorage';
import { getExtensionForContentType } from '../utils/validation/attachmentValidation';

/**
 * Creates a default test configuration for unit tests.
 * Used in unit tests to avoid duplicating config setup and to bypass
 * environment variable requirements.
 */
export function createUnitTestServiceConfig(): ServiceConfig {
    return {
        projectId: 'test-project',
        cloudTasksLocation: 'us-central1',
        cloudTasksServiceAccount: 'test-project@appspot.gserviceaccount.com',
        functionsUrl: 'http://foo/test-project/us-central1',
        minRegistrationDurationMs: 0,
        storagePublicBaseUrl: 'https://firebasestorage.googleapis.com',
    };
}

/**
 * Test implementation of GroupAttachmentStorage using StubStorage.
 * Used in tests that create ComponentBuilder directly.
 */
export class StubGroupAttachmentStorage implements GroupAttachmentStorage {
    constructor(private readonly storage: StubStorage) {}

    async uploadAttachment(
        groupId: GroupId,
        attachmentId: AttachmentId,
        buffer: Buffer,
        contentType: string,
        fileName: string,
        uploadedBy: UserId,
    ): Promise<AttachmentMetadata> {
        const extension = getExtensionForContentType(contentType);
        const filePath = `attachments/${groupId}/${attachmentId}.${extension}`;
        const bucket = this.storage.bucket();
        const file = bucket.file(filePath);

        const metadata: AttachmentMetadata = {
            groupId,
            attachmentId,
            fileName,
            uploadedBy,
            uploadedAt: new Date().toISOString(),
            contentType,
            sizeBytes: buffer.length,
        };

        const metadataStrings: Record<string, string> = {
            groupId: metadata.groupId,
            attachmentId: metadata.attachmentId,
            fileName: metadata.fileName,
            uploadedBy: metadata.uploadedBy,
            uploadedAt: metadata.uploadedAt,
            contentType: metadata.contentType,
            sizeBytes: String(metadata.sizeBytes),
        };

        await file.save(buffer, {
            metadata: {
                contentType,
                cacheControl: 'private, max-age=3600',
                metadata: metadataStrings,
            },
        });

        return metadata;
    }

    async getAttachmentMetadata(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentMetadataResult | null> {
        const files = this.storage.getAllFiles();
        const entry = Array.from(files.entries()).find(([key]) =>
            key.includes(`attachments/${groupId}/${attachmentId}.`),
        );

        if (!entry) {
            return null;
        }

        const [, storedFile] = entry;
        const customMetadata = storedFile.metadata?.metadata ?? {};
        const buffer = Buffer.isBuffer(storedFile.content) ? storedFile.content : Buffer.from(storedFile.content ?? []);

        return {
            attachmentId,
            fileName: typeof customMetadata.fileName === 'string' ? customMetadata.fileName : `attachment-${attachmentId}`,
            contentType: storedFile.metadata?.contentType ?? 'application/octet-stream',
            sizeBytes: buffer.length,
        };
    }

    async getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentStreamResult> {
        const files = this.storage.getAllFiles();
        const entry = Array.from(files.entries()).find(([key]) =>
            key.includes(`attachments/${groupId}/${attachmentId}.`),
        );

        if (!entry) {
            throw new Error(`Attachment not found: ${attachmentId}`);
        }

        const [, storedFile] = entry;
        const buffer = Buffer.isBuffer(storedFile.content) ? storedFile.content : Buffer.from(storedFile.content ?? []);
        const customMetadata = storedFile.metadata?.metadata ?? {};

        return {
            stream: Readable.from(buffer),
            contentType: storedFile.metadata?.contentType ?? 'application/octet-stream',
            sizeBytes: buffer.length,
            fileName: typeof customMetadata.fileName === 'string' ? customMetadata.fileName : `attachment-${attachmentId}`,
        };
    }

    async deleteAttachment(groupId: GroupId, attachmentId: AttachmentId): Promise<void> {
        const files = this.storage.getAllFiles();
        const entry = Array.from(files.entries()).find(([key]) =>
            key.includes(`attachments/${groupId}/${attachmentId}.`),
        );

        if (!entry) {
            throw new Error(`Attachment not found: ${attachmentId}`);
        }

        const [filePath] = entry;
        const pathOnly = filePath.includes(':') ? filePath.split(':')[1] : filePath;
        await this.storage.bucket().file(pathOnly).delete();
    }
}
