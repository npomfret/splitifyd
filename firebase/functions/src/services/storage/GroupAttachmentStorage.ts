import type { Bucket, File } from '@google-cloud/storage';
import type { AttachmentId, GroupId, UserId } from '@billsplit-wl/shared';
import { getStorage as getFirebaseStorage } from 'firebase-admin/storage';
import { Readable } from 'stream';
import { getStorage } from '../../firebase';
import { logger } from '../../logger';
import { createStorage, type IStorage } from '../../storage-wrapper';
import { getExtensionForContentType } from '../../utils/validation/attachmentValidation';

/**
 * Storage interface extended with test helper method.
 * StubStorage implements this for unit tests.
 */
interface StubStorageWithFiles extends IStorage {
    getAllFiles(): Map<string, { content?: Buffer; metadata?: { contentType?: string; metadata?: Record<string, string>; }; }>;
}

/**
 * Type guard to check if storage has getAllFiles (i.e., is StubStorage).
 */
function isStubStorage(storage: IStorage): storage is StubStorageWithFiles {
    return typeof (storage as StubStorageWithFiles).getAllFiles === 'function';
}

/**
 * Metadata stored with each attachment in Firebase Storage.
 */
export interface AttachmentMetadata {
    groupId: string;
    attachmentId: string;
    fileName: string;
    uploadedBy: string;
    uploadedAt: string;
    contentType: string;
    sizeBytes: number;
}

/**
 * Result from getAttachmentStream for proxy streaming.
 */
export interface AttachmentStreamResult {
    stream: Readable;
    contentType: string;
    sizeBytes: number;
    fileName: string;
}

export interface GroupAttachmentStorage {
    uploadAttachment(
        groupId: GroupId,
        attachmentId: AttachmentId,
        buffer: Buffer,
        contentType: string,
        fileName: string,
        uploadedBy: UserId,
    ): Promise<AttachmentMetadata>;

    /**
     * Get attachment stream for proxy serving.
     * @param groupId - Group ID
     * @param attachmentId - Attachment ID
     */
    getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentStreamResult>;

    /**
     * Delete an attachment.
     * @param groupId - Group ID
     * @param attachmentId - Attachment ID
     */
    deleteAttachment(groupId: GroupId, attachmentId: AttachmentId): Promise<void>;
}

let _instance: GroupAttachmentStorage | undefined;

interface GroupAttachmentStorageConfig {
    storage?: IStorage;
    useFirebaseAdmin?: boolean;
}

/**
 * Factory function to create GroupAttachmentStorage with dependency injection support.
 *
 * @param config - Optional configuration for testing
 * @param config.storage - IStorage instance (defaults to production Firebase Storage)
 * @returns Singleton GroupAttachmentStorage instance
 */
export function createGroupAttachmentStorage(config?: GroupAttachmentStorageConfig): GroupAttachmentStorage {
    if (!_instance) {
        const storage = config?.storage ?? createStorage(getStorage());
        _instance = new CloudGroupAttachmentStorage(storage, config?.useFirebaseAdmin ?? true);
    }
    return _instance;
}

/**
 * Reset the singleton instance. Only used for testing.
 * @internal
 */
export function resetGroupAttachmentStorage(): void {
    _instance = undefined;
}

class CloudGroupAttachmentStorage implements GroupAttachmentStorage {
    private static readonly ATTACHMENT_EXTENSIONS = ['jpg', 'png', 'webp', 'pdf', 'bin'];

    constructor(
        private readonly storage: IStorage,
        private readonly useFirebaseAdmin: boolean,
    ) {}

    async uploadAttachment(
        groupId: GroupId,
        attachmentId: AttachmentId,
        buffer: Buffer,
        contentType: string,
        fileName: string,
        uploadedBy: UserId,
    ): Promise<AttachmentMetadata> {
        const bucket = this.storage.bucket();

        const extension = getExtensionForContentType(contentType);
        const filePath = `attachments/${groupId}/${attachmentId}.${extension}`;

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

        // Convert AttachmentMetadata to Record<string, string> for storage
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

        logger.info('Uploaded group attachment', {
            groupId,
            attachmentId,
            fileName,
            filePath,
            size: buffer.length,
            uploadedBy,
        });

        return metadata;
    }

    async getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentStreamResult> {
        if (this.useFirebaseAdmin) {
            const bucket = getFirebaseStorage().bucket();
            const { filePath, file } = await this.findExistingFileForRead(bucket, groupId, attachmentId);

            const [metadata] = await file.getMetadata();
            const customMetadata = metadata.metadata || {};

            const stream = file.createReadStream();

            return {
                stream,
                contentType: metadata.contentType || 'application/octet-stream',
                sizeBytes: Number(metadata.size) || 0,
                fileName: typeof customMetadata.fileName === 'string' ? customMetadata.fileName : `attachment-${attachmentId}`,
            };
        }

        // Stub implementation for tests (no Firebase Admin available)
        if (isStubStorage(this.storage)) {
            const files = this.storage.getAllFiles();
            const entry = Array.from(files.entries()).find(([key]) => key.includes(`attachments/${groupId}/${attachmentId}.`));
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

        throw new Error('getAttachmentStream requires Firebase Admin SDK');
    }

    async deleteAttachment(groupId: GroupId, attachmentId: AttachmentId): Promise<void> {
        // For stub storage (tests), check the files map directly
        if (isStubStorage(this.storage)) {
            const files = this.storage.getAllFiles();
            const entry = Array.from(files.entries()).find(([key]) =>
                key.includes(`attachments/${groupId}/${attachmentId}.`),
            );

            if (!entry) {
                throw new Error(`Attachment not found: ${attachmentId}`);
            }

            const [filePath] = entry;
            // Extract just the path portion (StubStorage keys are "bucket:path")
            const pathOnly = filePath.includes(':') ? filePath.split(':')[1] : filePath;
            await this.storage.bucket().file(pathOnly).delete();
            logger.info('Deleted group attachment', { groupId, attachmentId, filePath: pathOnly });
            return;
        }

        // Production path: use Firebase Admin SDK directly for exists() support
        const bucket = getFirebaseStorage().bucket();
        for (const ext of CloudGroupAttachmentStorage.ATTACHMENT_EXTENSIONS) {
            const filePath = `attachments/${groupId}/${attachmentId}.${ext}`;
            const file = bucket.file(filePath);
            const [exists] = await file.exists();

            if (exists) {
                await file.delete();
                logger.info('Deleted group attachment', { groupId, attachmentId, filePath });
                return;
            }
        }

        throw new Error(`Attachment not found: ${attachmentId}`);
    }

    private async findExistingFileForRead(
        bucket: Bucket,
        groupId: GroupId,
        attachmentId: AttachmentId,
    ): Promise<{ filePath: string; file: File; }> {
        for (const ext of CloudGroupAttachmentStorage.ATTACHMENT_EXTENSIONS) {
            const filePath = `attachments/${groupId}/${attachmentId}.${ext}`;
            const file = bucket.file(filePath);
            const [exists] = await file.exists();
            if (exists) {
                return { filePath, file };
            }
        }

        throw new Error(`Attachment not found: ${attachmentId}`);
    }
}
