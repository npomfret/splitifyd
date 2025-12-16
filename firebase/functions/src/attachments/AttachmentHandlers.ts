import { AttachmentDTO, toAttachmentId, toUserId } from '@billsplit-wl/shared';
import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import { GroupMemberService } from '../services/GroupMemberService';
import { type GroupAttachmentStorage } from '../services/storage/GroupAttachmentStorage';
import { validateCommentAttachment, validateReceiptUpload } from '../utils/validation/attachmentValidation';
import type { AttachmentUploadType } from './validation';
import { validateAttachmentParams, validateUploadAttachmentRequest } from './validation';

export class AttachmentHandlers {
    constructor(
        private readonly groupMemberService: GroupMemberService,
        private readonly groupAttachmentStorage: GroupAttachmentStorage,
    ) {}

    uploadAttachment: RequestHandler = async (req, res) => {
        const authUser = (req as AuthenticatedRequest).user;
        if (!authUser?.uid) {
            throw Errors.authRequired();
        }
        const userId = toUserId(authUser.uid);
        const { groupId, type, contentType, fileName, buffer } = validateUploadAttachmentRequest(
            req.params,
            req.query,
            req.headers,
            req.body,
        );

        await this.groupMemberService.getGroupAccessContext(groupId, userId, {
            notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
            forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
        });

        this.validateAttachment(buffer, contentType, type);

        const attachmentId = toAttachmentId(randomUUID());

        const metadata = await this.groupAttachmentStorage.uploadAttachment(
            groupId,
            attachmentId,
            buffer,
            contentType,
            fileName,
            userId,
        );

        const attachment: AttachmentDTO = {
            id: attachmentId,
            fileName: metadata.fileName,
            contentType: metadata.contentType,
            sizeBytes: metadata.sizeBytes,
        };

        const url = `/api/groups/${groupId}/attachments/${attachmentId}`;

        res.status(HTTP_STATUS.CREATED).json({ attachment, url });
    };

    getAttachment: RequestHandler = async (req, res) => {
        const authUser = (req as AuthenticatedRequest).user;
        if (!authUser?.uid) {
            throw Errors.authRequired();
        }
        const userId = toUserId(authUser.uid);
        const { groupId, attachmentId } = validateAttachmentParams(req.params);

        await this.groupMemberService.getGroupAccessContext(groupId, userId, {
            notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
            forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
        });

        try {
            const attachment = await this.groupAttachmentStorage.getAttachmentStream(groupId, attachmentId);
            const chunks: Buffer[] = [];
            for await (const chunk of attachment.stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const buffer = Buffer.concat(chunks);

            res.status(HTTP_STATUS.OK);
            res.type(attachment.contentType);
            res.send(buffer);
        } catch (error: any) {
            if (error instanceof Error && error.message.includes('Attachment not found')) {
                throw Errors.notFound('Attachment', 'ATTACHMENT_NOT_FOUND');
            }
            throw error;
        }
    };

    deleteAttachment: RequestHandler = async (req, res) => {
        const authUser = (req as AuthenticatedRequest).user;
        if (!authUser?.uid) {
            throw Errors.authRequired();
        }
        const userId = toUserId(authUser.uid);
        const { groupId, attachmentId } = validateAttachmentParams(req.params);

        await this.groupMemberService.getGroupAccessContext(groupId, userId, {
            notFoundErrorFactory: () => Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND),
            forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER),
        });

        try {
            await this.groupAttachmentStorage.deleteAttachment(groupId, attachmentId);
        } catch (error: any) {
            if (error instanceof Error && error.message.includes('Attachment not found')) {
                throw Errors.notFound('Attachment', 'ATTACHMENT_NOT_FOUND');
            }
            throw error;
        }
        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    private validateAttachment(buffer: Buffer, contentType: string, type: AttachmentUploadType): void {
        if (type === 'receipt') {
            validateReceiptUpload(buffer, contentType);
            return;
        }

        validateCommentAttachment(buffer, contentType);
    }
}
