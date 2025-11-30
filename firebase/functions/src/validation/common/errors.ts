import { z } from 'zod';
import { ApiError, ErrorCode } from '../../errors';
import { HTTP_STATUS } from '../../constants';

type IssueMessage = string | ((issue: z.ZodIssue) => string | undefined);

interface IssueMapping {
    /** Detail code for debugging (becomes the `detail` field in error response) */
    code: string;
    message?: IssueMessage;
    details?: IssueMessage;
}

interface ErrorMapperOptions {
    /** Default detail code when no mapping matches */
    defaultCode: string;
    defaultMessage?: IssueMessage;
    defaultDetails?: IssueMessage;
    statusCode?: number;
}

const resolveMessage = (source: IssueMessage | undefined, issue: z.ZodIssue): string | undefined => {
    if (!source) {
        return undefined;
    }
    return typeof source === 'function' ? source(issue) : source;
};

const pickMapping = (
    issue: z.ZodIssue,
    mappings: Record<string, IssueMapping | undefined>,
): IssueMapping | undefined => {
    const fullPath = issue.path.join('.');
    if (fullPath && mappings[fullPath]) {
        return mappings[fullPath];
    }

    const topLevel = issue.path.length > 0 ? String(issue.path[0]) : '';
    if (topLevel && mappings[topLevel]) {
        return mappings[topLevel];
    }

    return undefined;
};

/**
 * Creates an error mapper for Zod validation errors.
 *
 * Uses the two-tier error code system:
 * - Primary code is always `ErrorCode.VALIDATION_ERROR` (Tier 1 - for i18n)
 * - The mapping `code` becomes the `detail` field (Tier 2 - for debugging)
 */
export const createZodErrorMapper = (
    mappings: Record<string, IssueMapping | undefined>,
    options: ErrorMapperOptions,
) => {
    return (error: z.ZodError): never => {
        const [issue] = error.issues;
        const mapping = pickMapping(issue, mappings);
        const fieldPath = issue.path.join('.');

        // The mapping code becomes the detail (Tier 2 debugging code)
        const detailCode = mapping?.code ?? options.defaultCode;
        const details = resolveMessage(mapping?.details ?? options.defaultDetails, issue);

        throw new ApiError(
            options.statusCode ?? HTTP_STATUS.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            {
                detail: detailCode,
                field: fieldPath || undefined,
                ...(details && { message: details }),
            },
        );
    };
};
