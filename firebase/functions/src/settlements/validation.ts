import {
    CreateSettlementRequest,
    CreateSettlementRequestSchema,
    ListSettlementsQuerySchema,
    toGroupId,
    toISOString,
    UpdateSettlementRequest,
    UpdateSettlementRequestSchema,
} from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { ErrorDetail, Errors } from '../errors';
import { validateAmountPrecision } from '../utils/amount-validation';
import {
    createRequestValidator,
    createZodErrorMapper,
    sanitizeInputString,
    validateGroupIdParam,
    validateSettlementId,
} from '../validation/common';

// Re-export centralized ID validators for backward compatibility
export { validateGroupIdParam, validateSettlementId };

const createSettlementErrorMapper = createZodErrorMapper(
    {
        groupId: {
            code: 'VALIDATION_ERROR',
            message: () => 'Group ID is required',
        },
        payerId: {
            code: 'VALIDATION_ERROR',
            message: () => 'Payer ID is required',
        },
        payeeId: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message ?? 'Payee ID is required',
        },
        amount: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        currency: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        date: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        note: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const updateSettlementErrorMapperBase = createZodErrorMapper(
    {
        amount: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        currency: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        date: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        note: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const baseValidateCreateSettlement = createRequestValidator({
    schema: CreateSettlementRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const date = value.date === null || value.date === undefined ? undefined : value.date;
        const note = value.note === undefined ? undefined : sanitizeInputString(value.note);

        return {
            groupId: toGroupId(value.groupId.trim()),
            payerId: toUserId(value.payerId.trim()),
            payeeId: toUserId(value.payeeId.trim()),
            amount: value.amount,
            currency: value.currency,
            date: date !== undefined ? toISOString(date) : undefined,
            note,
        } satisfies CreateSettlementRequest;
    },
    mapError: (error) => createSettlementErrorMapper(error),
}) as (body: unknown) => CreateSettlementRequest;

const mapUpdateSettlementError = (error: z.ZodError): never => {
    if (error.issues.some((issue) => issue.message === 'At least one field must be provided for update')) {
        throw Errors.invalidRequest(ErrorDetail.NO_UPDATE_FIELDS);
    }

    return updateSettlementErrorMapperBase(error);
};

const baseValidateUpdateSettlement = createRequestValidator({
    schema: UpdateSettlementRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const update: UpdateSettlementRequest = {};

        if (value.amount !== undefined) {
            update.amount = value.amount;
        }

        if (value.currency !== undefined) {
            update.currency = value.currency;
        }

        if (value.date !== undefined) {
            if (value.date !== null) {
                update.date = toISOString(value.date);
            }
        }

        if (value.note !== undefined) {
            update.note = sanitizeInputString(value.note);
        }

        return update;
    },
    mapError: (error) => mapUpdateSettlementError(error),
}) as (body: unknown) => UpdateSettlementRequest;

export const validateCreateSettlement = (body: unknown): CreateSettlementRequest => {
    const value = baseValidateCreateSettlement(body);

    // Validate amount precision against currency
    try {
        validateAmountPrecision(value.amount, value.currency);
    } catch (error) {
        throw Errors.validationError('amount', ErrorDetail.INVALID_AMOUNT_PRECISION);
    }

    return value;
};

export const validateUpdateSettlement = (body: unknown): UpdateSettlementRequest => {
    const update = baseValidateUpdateSettlement(body);

    // Require currency when updating amount (allows precision validation)
    if (update.amount !== undefined && update.currency === undefined) {
        throw Errors.validationError('currency', ErrorDetail.MISSING_FIELD);
    }

    // Validate amount precision against currency
    if (update.amount !== undefined && update.currency !== undefined) {
        try {
            validateAmountPrecision(update.amount, update.currency);
        } catch (error) {
            throw Errors.validationError('amount', ErrorDetail.INVALID_AMOUNT_PRECISION);
        }
    }

    return update;
};

// ========================================================================
// List Query Validators
// ========================================================================

const listSettlementsQueryErrorMapper = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

export interface ListSettlementsQueryResult {
    limit: number;
    cursor?: string;
    includeDeleted: boolean;
}

/**
 * Validate list settlements query parameters.
 */
export const validateListSettlementsQuery = createRequestValidator({
    schema: ListSettlementsQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: listSettlementsQueryErrorMapper,
}) as (query: unknown) => ListSettlementsQueryResult;
