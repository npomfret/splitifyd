import { toAttachmentId, toGroupId, toUserId } from '@billsplit-wl/shared';
import { StubStorage } from 'ts-firebase-simulator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGroupAttachmentStorage, resetGroupAttachmentStorage } from '../../../../services/storage/GroupAttachmentStorage';

describe('GroupAttachmentStorage', () => {
    let stubStorage: StubStorage;

    beforeEach(() => {
        stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
    });

    afterEach(() => {
        resetGroupAttachmentStorage();
    });

    describe('uploadAttachment', () => {
        it('should upload attachment and return metadata', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-image-data');
            const groupId = toGroupId('group-123');
            const attachmentId = toAttachmentId('attach-456');
            const uploadedBy = toUserId('user-789');

            const metadata = await storage.uploadAttachment(
                groupId,
                attachmentId,
                buffer,
                'image/jpeg',
                'receipt.jpg',
                uploadedBy,
            );

            expect(metadata.groupId).toBe('group-123');
            expect(metadata.attachmentId).toBe('attach-456');
            expect(metadata.fileName).toBe('receipt.jpg');
            expect(metadata.uploadedBy).toBe('user-789');
            expect(metadata.contentType).toBe('image/jpeg');
            expect(metadata.sizeBytes).toBe(buffer.length);
            expect(metadata.uploadedAt).toBeDefined();
        });

        it('should store file with correct path structure', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-image-data');
            const groupId = toGroupId('group-abc');
            const attachmentId = toAttachmentId('attach-xyz');
            const uploadedBy = toUserId('user-123');

            await storage.uploadAttachment(groupId, attachmentId, buffer, 'image/png', 'photo.png', uploadedBy);

            const files = stubStorage.getAllFiles();
            expect(files.size).toBe(1);

            const filePath = Array.from(files.keys())[0];
            // StubStorage includes bucket name in key: "bucket:path"
            expect(filePath).toBe('test-bucket:attachments/group-abc/attach-xyz.png');
        });

        it('should set correct content type metadata', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-image-data');
            const groupId = toGroupId('group-123');
            const attachmentId = toAttachmentId('attach-456');
            const uploadedBy = toUserId('user-789');

            await storage.uploadAttachment(groupId, attachmentId, buffer, 'image/webp', 'image.webp', uploadedBy);

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata?.contentType).toBe('image/webp');
        });

        it('should set private cache control', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-image-data');
            const groupId = toGroupId('group-123');
            const attachmentId = toAttachmentId('attach-456');
            const uploadedBy = toUserId('user-789');

            await storage.uploadAttachment(groupId, attachmentId, buffer, 'image/jpeg', 'receipt.jpg', uploadedBy);

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            expect(file.metadata?.cacheControl).toBe('private, max-age=3600');
        });

        it('should store attachment metadata', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-image-data');
            const groupId = toGroupId('group-123');
            const attachmentId = toAttachmentId('attach-456');
            const uploadedBy = toUserId('user-789');

            await storage.uploadAttachment(groupId, attachmentId, buffer, 'image/jpeg', 'receipt.jpg', uploadedBy);

            const files = stubStorage.getAllFiles();
            const file = Array.from(files.values())[0];
            const customMetadata = file.metadata?.metadata as Record<string, string>;

            expect(customMetadata.groupId).toBe('group-123');
            expect(customMetadata.attachmentId).toBe('attach-456');
            expect(customMetadata.fileName).toBe('receipt.jpg');
            expect(customMetadata.uploadedBy).toBe('user-789');
            expect(customMetadata.contentType).toBe('image/jpeg');
            expect(customMetadata.sizeBytes).toBe(String(buffer.length));
            expect(customMetadata.uploadedAt).toBeDefined();
        });

        it('should handle different content types with correct extensions', async () => {
            const formats = [
                { contentType: 'image/jpeg', expectedExt: 'jpg' },
                { contentType: 'image/png', expectedExt: 'png' },
                { contentType: 'image/webp', expectedExt: 'webp' },
                { contentType: 'application/pdf', expectedExt: 'pdf' },
            ];

            for (const { contentType, expectedExt } of formats) {
                resetGroupAttachmentStorage();
                stubStorage = new StubStorage({ defaultBucketName: 'test-bucket' });
                const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });

                const buffer = Buffer.from('fake-data');
                const groupId = toGroupId('group-fmt');
                const attachmentId = toAttachmentId(`attach-${expectedExt}`);
                const uploadedBy = toUserId('user-123');

                await storage.uploadAttachment(groupId, attachmentId, buffer, contentType, `file.${expectedExt}`, uploadedBy);

                const files = stubStorage.getAllFiles();
                const filePath = Array.from(files.keys())[0];
                expect(filePath).toContain(`.${expectedExt}`);
            }
        });

        it('should use bin extension for unknown content type', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-data');
            const groupId = toGroupId('group-123');
            const attachmentId = toAttachmentId('attach-456');
            const uploadedBy = toUserId('user-789');

            await storage.uploadAttachment(groupId, attachmentId, buffer, 'application/octet-stream', 'file.dat', uploadedBy);

            const files = stubStorage.getAllFiles();
            const filePath = Array.from(files.keys())[0];
            expect(filePath).toContain('.bin');
        });
    });

    describe('deleteAttachment', () => {
        it('should delete existing attachment', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-image-data');
            const groupId = toGroupId('group-del');
            const attachmentId = toAttachmentId('attach-del');
            const uploadedBy = toUserId('user-123');

            // Upload first
            await storage.uploadAttachment(groupId, attachmentId, buffer, 'image/jpeg', 'receipt.jpg', uploadedBy);
            expect(stubStorage.getAllFiles().size).toBe(1);

            // Delete
            await storage.deleteAttachment(groupId, attachmentId, 'image/jpeg');

            expect(stubStorage.getAllFiles().size).toBe(0);
        });

        it('should not throw when deleting non-existent attachment', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const groupId = toGroupId('group-nonexistent');
            const attachmentId = toAttachmentId('attach-nonexistent');

            // Should not throw
            await expect(
                storage.deleteAttachment(groupId, attachmentId, 'image/jpeg'),
            )
                .resolves
                .toBeUndefined();
        });

        it('should delete with correct content type for file extension', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const buffer = Buffer.from('fake-pdf-data');
            const groupId = toGroupId('group-pdf');
            const attachmentId = toAttachmentId('attach-pdf');
            const uploadedBy = toUserId('user-123');

            // Upload PDF
            await storage.uploadAttachment(groupId, attachmentId, buffer, 'application/pdf', 'doc.pdf', uploadedBy);
            expect(stubStorage.getAllFiles().size).toBe(1);

            // Delete with correct content type
            await storage.deleteAttachment(groupId, attachmentId, 'application/pdf');

            expect(stubStorage.getAllFiles().size).toBe(0);
        });
    });

    describe('getAttachmentStream', () => {
        it('should throw when not using Firebase Admin SDK', async () => {
            const storage = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const groupId = toGroupId('group-123');
            const attachmentId = toAttachmentId('attach-456');

            await expect(
                storage.getAttachmentStream(groupId, attachmentId, 'image/jpeg'),
            )
                .rejects
                .toThrow('getAttachmentStream requires Firebase Admin SDK');
        });
    });

    describe('singleton behavior', () => {
        it('should return same instance on subsequent calls', () => {
            const storage1 = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            const storage2 = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });

            expect(storage1).toBe(storage2);
        });

        it('should return fresh instance after reset', () => {
            const storage1 = createGroupAttachmentStorage({ storage: stubStorage, useFirebaseAdmin: false });
            resetGroupAttachmentStorage();

            const newStubStorage = new StubStorage({ defaultBucketName: 'new-bucket' });
            const storage2 = createGroupAttachmentStorage({ storage: newStubStorage, useFirebaseAdmin: false });

            expect(storage1).not.toBe(storage2);
        });
    });
});
