import type { AttachmentId, GroupId, UserId } from '@billsplit-wl/shared';
import type { Readable } from 'stream';
import { getStorage as getFirebaseStorage } from 'firebase-admin/storage';
import { getStorage } from '../../firebase';
import { logger } from '../../logger';
import { createStorage, type IStorage } from '../../storage-wrapper';

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
     * @param contentType - Content type (needed to determine file extension)
     */
    getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId, contentType: string): Promise<AttachmentStreamResult>;

    /**
     * Delete an attachment.
     * @param groupId - Group ID
     * @param attachmentId - Attachment ID
     * @param contentType - Content type (needed to determine file extension)
     */
    deleteAttachment(groupId: GroupId, attachmentId: AttachmentId, contentType: string): Promise<void>;
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

        const extension = this.getExtensionFromContentType(contentType);
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

    async getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId, contentType: string): Promise<AttachmentStreamResult> {
        const extension = this.getExtensionFromContentType(contentType);
        const filePath = `attachments/${groupId}/${attachmentId}.${extension}`;

        if (this.useFirebaseAdmin) {
            // Use Firebase Admin SDK for streaming (not available in IStorage interface)
            const bucket = getFirebaseStorage().bucket();
            const file = bucket.file(filePath);

            const [exists] = await file.exists();
            if (!exists) {
                throw new Error(`Attachment not found: ${attachmentId}`);
            }

            const [metadata] = await file.getMetadata();
            const customMetadata = metadata.metadata || {};

            const stream = file.createReadStream();

            return {
                stream,
                contentType: metadata.contentType || 'application/octet-stream',
                sizeBytes: Number(metadata.size) || 0,
                fileName: typeof customMetadata.fileName === 'string' ? customMetadata.fileName : `attachment-${attachmentId}`,
            };
        } else {
            // Stub implementation for testing - not supported
            throw new Error('getAttachmentStream requires Firebase Admin SDK');
        }
    }

    async deleteAttachment(groupId: GroupId, attachmentId: AttachmentId, contentType: string): Promise<void> {
        const bucket = this.storage.bucket();

        const extension = this.getExtensionFromContentType(contentType);
        const filePath = `attachments/${groupId}/${attachmentId}.${extension}`;

        try {
            await bucket.file(filePath).delete();
            logger.info('Deleted group attachment', { groupId, attachmentId, filePath });
        } catch (error) {
            logger.warn('Failed to delete group attachment', { groupId, attachmentId, filePath, error });
        }
    }

    private getExtensionFromContentType(contentType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
        };

        return map[contentType.toLowerCase()] || 'bin';
    }
}
