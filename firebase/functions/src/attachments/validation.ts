import { AttachmentId, GroupId, toAttachmentId, toGroupId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { ErrorDetail, Errors } from '../errors';

const AttachmentTypeSchema = z.enum(['receipt', 'comment']);

const UploadAttachmentParamsSchema = z.object({
    groupId: z.string().min(1).transform(toGroupId),
});

const UploadAttachmentQuerySchema = z.object({
    type: AttachmentTypeSchema,
});

const AttachmentParamsSchema = z.object({
    groupId: z.string().min(1).transform(toGroupId),
    attachmentId: z.string().min(1).transform(toAttachmentId),
});

export type AttachmentUploadType = z.infer<typeof AttachmentTypeSchema>;

export function validateUploadAttachmentRequest(
    params: unknown,
    query: unknown,
    headers: Record<string, unknown>,
    body: unknown,
): {
    groupId: GroupId;
    type: AttachmentUploadType;
    contentType: string;
    fileName: string;
    buffer: Buffer;
} {
    const parsedParams = UploadAttachmentParamsSchema.safeParse(params);
    if (!parsedParams.success) {
        throw Errors.validation({
            detail: 'INVALID_PARAMS',
            issues: parsedParams.error.issues,
        });
    }

    const parsedQuery = UploadAttachmentQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
        throw Errors.validation({
            detail: 'INVALID_QUERY_PARAMS',
            issues: parsedQuery.error.issues,
        });
    }

    const contentTypeHeader = headers['content-type'];
    if (!contentTypeHeader || typeof contentTypeHeader !== 'string') {
        throw Errors.validationError('contentType', ErrorDetail.MISSING_FIELD);
    }

    if (!Buffer.isBuffer(body)) {
        throw Errors.invalidRequest(ErrorDetail.MISSING_FILE);
    }

    const headerFileName = headers['x-file-name'];
    const fileName = typeof headerFileName === 'string' && headerFileName.trim().length > 0
        ? headerFileName.trim()
        : 'attachment';

    return {
        groupId: parsedParams.data.groupId,
        type: parsedQuery.data.type,
        contentType: contentTypeHeader,
        fileName,
        buffer: body,
    };
}

export function validateAttachmentParams(params: unknown): { groupId: GroupId; attachmentId: AttachmentId; } {
    const parsedParams = AttachmentParamsSchema.safeParse(params);
    if (!parsedParams.success) {
        throw Errors.validation({
            detail: 'INVALID_PARAMS',
            issues: parsedParams.error.issues,
        });
    }
    return parsedParams.data;
}
