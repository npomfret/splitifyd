import { ActivityFeedQuerySchema } from '@billsplit-wl/shared';
import { createRequestValidator, createZodErrorMapper } from '../validation/common';

// Error mapper for activity feed query validation
const mapActivityFeedQueryError = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Limit must be a number';
                }
                if (issue.message === 'Invalid input: expected number, received NaN') {
                    return 'Limit must be a number';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

// Validator for activity feed query parameters
export const validateActivityFeedQuery = createRequestValidator({
    schema: ActivityFeedQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapActivityFeedQueryError(error),
}) as (query: unknown) => { cursor?: string; limit: number };
