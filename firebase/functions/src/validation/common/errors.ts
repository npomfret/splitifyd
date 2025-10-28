import { z } from 'zod';
import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';

type IssueMessage = string | ((issue: z.ZodIssue) => string | undefined);

export interface IssueMapping {
    code: string;
    message?: IssueMessage;
    details?: IssueMessage;
}

export interface ErrorMapperOptions {
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

export const createZodErrorMapper = (
    mappings: Record<string, IssueMapping | undefined>,
    options: ErrorMapperOptions,
) => {
    return (error: z.ZodError): never => {
        const [issue] = error.issues;
        const mapping = pickMapping(issue, mappings);

        const code = mapping?.code ?? options.defaultCode;
        const message = resolveMessage(mapping?.message ?? options.defaultMessage, issue)
            ?? issue.message;
        const details = resolveMessage(mapping?.details ?? options.defaultDetails, issue);

        throw new ApiError(
            options.statusCode ?? HTTP_STATUS.BAD_REQUEST,
            code,
            message,
            details,
        );
    };
};
