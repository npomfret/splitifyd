import { CommentAttachmentRef, toAttachmentId } from '@billsplit-wl/shared';
import { CommentBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

const tinyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108020000009077053a0000000a49444154789c6360000002000100ff0ff30a0000000049454e44ae426082', 'hex');
const tinyPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
    'utf-8',
);

test.describe('Group Comment Attachments', () => {
    test('displays comment attachments (image + pdf)', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'group-attachments-view';
        const imageId = toAttachmentId('att-image');
        const pdfId = toAttachmentId('att-pdf');

        const comment = new CommentBuilder()
            .withId('comment-with-attachments')
            .withAuthorId(user.uid)
            .withAuthorName(user.displayName)
            .withText('Here are the files')
            .withAttachments([
                {
                    attachmentId: imageId,
                    fileName: 'receipt.png',
                    contentType: 'image/png',
                    sizeBytes: 1024,
                },
                {
                    attachmentId: pdfId,
                    fileName: 'invoice.pdf',
                    contentType: 'application/pdf',
                    sizeBytes: 2048,
                },
            ])
            .build();

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName('Attachments Group').build();
        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [comment], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, [comment]);

        await page.route(`**/api/groups/${groupId}/attachments/${imageId}`, async (route) => {
            await route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
        });
        await page.route(`**/api/groups/${groupId}/attachments/${pdfId}`, async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/pdf', body: tinyPdf });
        });

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);
        await groupDetailPage.ensureCommentsSectionExpanded();
        await groupDetailPage.verifyCommentVisible('Here are the files');

        await groupDetailPage.verifyCommentAttachmentVisible('receipt.png');
        await groupDetailPage.verifyCommentAttachmentVisible('invoice.pdf');
    });

    test('uploads attachments and submits comment with attachmentIds', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'group-attachments-upload';
        const uploadedId = toAttachmentId('uploaded-attachment');

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName('Upload Group').build();
        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, []);

        let receivedCommentPayload: { text?: string; attachmentIds?: string[]; } | null = null;

        await page.route(`**/api/groups/${groupId}/attachments?type=comment`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    attachment: {
                        id: uploadedId,
                        fileName: 'upload.png',
                        contentType: 'image/png',
                        sizeBytes: tinyPng.length,
                    },
                    url: `/api/groups/${groupId}/attachments/${uploadedId}`,
                }),
            });
        });

        await page.route(`**/api/groups/${groupId}/comments`, async (route) => {
            const payload = route.request().postDataJSON() as { text?: string; attachmentIds?: string[]; };
            receivedCommentPayload = payload;

            const commentAttachments: CommentAttachmentRef[] = [
                {
                    attachmentId: uploadedId,
                    fileName: 'upload.png',
                    contentType: 'image/png',
                    sizeBytes: tinyPng.length,
                },
            ];

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(
                    new CommentBuilder()
                        .withId('new-comment')
                        .withAuthorId(user.uid)
                        .withAuthorName(user.displayName)
                        .withText(payload.text ?? 'Uploaded comment')
                        .withAttachments(commentAttachments)
                        .build(),
                ),
            });
        });

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);
        await groupDetailPage.ensureCommentsSectionExpanded();

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-attachment-'));
        const filePath = path.join(tempDir, 'upload.png');
        fs.writeFileSync(filePath, tinyPng);

        await groupDetailPage.uploadCommentAttachment(filePath);
        await groupDetailPage.verifyComposerAttachmentVisible('upload.png');

        await groupDetailPage.addComment('Comment with attachment');
        await expect.poll(() => receivedCommentPayload).not.toBeNull();
        await groupDetailPage.verifyComposerAttachmentNotVisible('upload.png');

        expect(receivedCommentPayload!.attachmentIds).toEqual([uploadedId]);
        expect(receivedCommentPayload!.text).toBe('Comment with attachment');
    });

    test('removes attachment before submitting comment', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'group-attachments-remove';
        const uploadedId = toAttachmentId('upload-to-remove');

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName('Remove Attachment Group').build();
        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, []);

        let deleteAttachmentCalled = false;

        await page.route(`**/api/groups/${groupId}/attachments?type=comment`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    attachment: {
                        id: uploadedId,
                        fileName: 'remove-me.png',
                        contentType: 'image/png',
                        sizeBytes: tinyPng.length,
                    },
                    url: `/api/groups/${groupId}/attachments/${uploadedId}`,
                }),
            });
        });

        await page.route(`**/api/groups/${groupId}/attachments/${uploadedId}`, async (route) => {
            if (route.request().method() === 'DELETE') {
                deleteAttachmentCalled = true;
                await route.fulfill({ status: 204 });
            } else {
                await route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
            }
        });

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);
        await groupDetailPage.ensureCommentsSectionExpanded();

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-attachment-remove-'));
        const filePath = path.join(tempDir, 'remove-me.png');
        fs.writeFileSync(filePath, tinyPng);

        await groupDetailPage.uploadCommentAttachment(filePath);
        await groupDetailPage.verifyComposerAttachmentVisible('remove-me.png');

        await groupDetailPage.removeComposerAttachment('remove-me.png');
        await groupDetailPage.verifyComposerAttachmentNotVisible('remove-me.png');

        await expect.poll(() => deleteAttachmentCalled).toBe(true);
    });

    test('shows error for invalid file type', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'group-attachments-invalid-type';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName('Invalid Type Group').build();
        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, []);

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);
        await groupDetailPage.ensureCommentsSectionExpanded();

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-attachment-invalid-'));
        const filePath = path.join(tempDir, 'invalid.txt');
        fs.writeFileSync(filePath, 'This is not an image');

        await groupDetailPage.uploadCommentAttachment(filePath);
        await groupDetailPage.verifyAttachmentError('Only JPG, PNG, WebP, or PDF files are allowed');
    });

    test('shows error for file too large', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'group-attachments-too-large';

        const group = GroupDTOBuilder.groupForUser(user.uid).withId(groupId).withName('Large File Group').build();
        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .build(),
        ];

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withComments({ comments: [], hasMore: false })
            .build();

        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId, []);

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);
        await groupDetailPage.ensureCommentsSectionExpanded();

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-attachment-large-'));
        const filePath = path.join(tempDir, 'large.png');
        // Create a file > 5MB (5 * 1024 * 1024 + 1 bytes)
        const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
        // Add PNG header to pass initial type detection
        tinyPng.copy(largeBuffer, 0, 0, Math.min(tinyPng.length, 100));
        fs.writeFileSync(filePath, largeBuffer);

        await groupDetailPage.uploadCommentAttachment(filePath);
        await groupDetailPage.verifyAttachmentError('File is too large (max 5MB)');
    });
});
