import type { AttachmentId, GroupId, UserId } from '@billsplit-wl/shared';
import type { Bucket, File } from '@google-cloud/storage';
import type { Readable } from 'stream';
import { logger } from '../../logger';
import { getExtensionForContentType } from '../../utils/validation/attachmentValidation';

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

/**
 * Metadata result for attachment lookup (without streaming).
 */
export interface AttachmentMetadataResult {
    attachmentId: AttachmentId;
    fileName: string;
    contentType: string;
    sizeBytes: number;
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
     * Get attachment metadata without streaming.
     * Used to validate attachment exists and retrieve info for comment references.
     */
    getAttachmentMetadata(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentMetadataResult | null>;

    /**
     * Get attachment stream for proxy serving.
     */
    getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentStreamResult>;

    /**
     * Delete an attachment.
     */
    deleteAttachment(groupId: GroupId, attachmentId: AttachmentId): Promise<void>;
}

/**
 * Production implementation using Firebase Admin SDK.
 * Uses firebase-admin/storage directly for full functionality (exists, getMetadata, createReadStream).
 */
export class CloudGroupAttachmentStorage implements GroupAttachmentStorage {
    private static readonly ATTACHMENT_EXTENSIONS = ['jpg', 'png', 'webp', 'heic', 'heif', 'pdf', 'bin'];

    constructor(private readonly bucket: Bucket) {}

    async uploadAttachment(
        groupId: GroupId,
        attachmentId: AttachmentId,
        buffer: Buffer,
        contentType: string,
        fileName: string,
        uploadedBy: UserId,
    ): Promise<AttachmentMetadata> {
        const bucket = this.bucket;
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

    async getAttachmentMetadata(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentMetadataResult | null> {
        const bucket = this.bucket;

        for (const ext of CloudGroupAttachmentStorage.ATTACHMENT_EXTENSIONS) {
            const filePath = `attachments/${groupId}/${attachmentId}.${ext}`;
            const file = bucket.file(filePath);
            const [exists] = await file.exists();

            if (exists) {
                const [metadata] = await file.getMetadata();
                const customMetadata = metadata.metadata || {};

                return {
                    attachmentId,
                    fileName: typeof customMetadata.fileName === 'string' ? customMetadata.fileName : `attachment-${attachmentId}`,
                    contentType: metadata.contentType || 'application/octet-stream',
                    sizeBytes: Number(metadata.size) || 0,
                };
            }
        }

        return null;
    }

    async getAttachmentStream(groupId: GroupId, attachmentId: AttachmentId): Promise<AttachmentStreamResult> {
        const bucket = this.bucket;
        const { file } = await this.findExistingFile(bucket, groupId, attachmentId);

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

    async deleteAttachment(groupId: GroupId, attachmentId: AttachmentId): Promise<void> {
        const bucket = this.bucket;
        const { filePath, file } = await this.findExistingFile(bucket, groupId, attachmentId);
        await file.delete();
        logger.info('Deleted group attachment', { groupId, attachmentId, filePath });
    }

    private async findExistingFile(
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
