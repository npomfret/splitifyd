import { CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

function createJpegBuffer(): Buffer {
    const buffer = Buffer.alloc(32);
    buffer.set([0xff, 0xd8, 0xff], 0); // JPEG magic number
    return buffer;
}

describe('attachments api', () => {
    let appDriver: AppDriver;
    let userId: string;
    let otherUserId: string;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const { users } = await appDriver.createTestUsers({ count: 2 });
        [userId, otherUserId] = users;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    it('uploads an attachment for a group member and stores metadata', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

        const buffer = createJpegBuffer();
        const uploadResponse = await appDriver.uploadAttachment(
            group.id,
            'comment',
            buffer,
            'image/jpeg',
            userId,
            'receipt.jpg',
        );

        expect(uploadResponse.attachment.fileName).toBe('receipt.jpg');
        expect(uploadResponse.attachment.contentType).toBe('image/jpeg');
        expect(uploadResponse.attachment.sizeBytes).toBe(buffer.length);
        expect(uploadResponse.url).toBe(`/api/groups/${group.id}/attachments/${uploadResponse.attachment.id}`);

        const files = appDriver.storageStub.getAllFiles();
        expect(files.size).toBe(1);
        const [[path, file]] = Array.from(files.entries());
        expect(path).toContain(`attachments/${group.id}/`);
        expect(path.endsWith('.jpg')).toBe(true);
        expect(file.metadata?.metadata?.fileName).toBe('receipt.jpg');
    });

    it('rejects uploads from non-members', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

        await expect(
            appDriver.uploadAttachment(group.id, 'comment', createJpegBuffer(), 'image/jpeg', otherUserId, 'note.jpg'),
        )
            .rejects
            .toMatchObject({ code: 'FORBIDDEN' });
    });

    it('streams the attachment back with correct content type', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const buffer = createJpegBuffer();

        const { attachment } = await appDriver.uploadAttachment(
            group.id,
            'receipt',
            buffer,
            'image/jpeg',
            userId,
            'photo.jpg',
        );

        const download = await appDriver.getAttachment(group.id, attachment.id, userId);
        expect(download.contentType).toBe('image/jpeg');
        expect(download.body.equals(buffer)).toBe(true);
    });

    it('deletes an attachment and removes the stored file', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
        const buffer = createJpegBuffer();

        const { attachment } = await appDriver.uploadAttachment(
            group.id,
            'comment',
            buffer,
            'image/jpeg',
            userId,
            'delete-me.jpg',
        );

        expect(appDriver.storageStub.getAllFiles().size).toBe(1);

        await appDriver.deleteAttachment(group.id, attachment.id, userId);

        expect(appDriver.storageStub.getAllFiles().size).toBe(0);
    });
});
