import {
    CreateSettlementRequest,
    CreateSettlementRequestSchema,
    ListSettlementsQuerySchema,
    type SettlementId,
    toGroupId,
    toISOString,
    toSettlementId,
    UpdateSettlementRequest,
    UpdateSettlementRequestSchema,
} from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { validateAmountPrecision } from '../utils/amount-validation';
import { ApiError } from '../utils/errors';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString } from '../validation/common';

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
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'VALIDATION_ERROR',
            'At least one field must be provided for update',
        );
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

const settlementIdSchema = z
    .string()
    .trim()
    .min(1, 'Settlement ID cannot be empty');

export const validateCreateSettlement = (body: unknown): CreateSettlementRequest => {
    const value = baseValidateCreateSettlement(body);

    // Validate amount precision against currency
    try {
        validateAmountPrecision(value.amount, value.currency);
    } catch (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
    }

    return value;
};

export const validateUpdateSettlement = (body: unknown): UpdateSettlementRequest => {
    const update = baseValidateUpdateSettlement(body);

    // Require currency when updating amount (allows precision validation)
    if (update.amount !== undefined && update.currency === undefined) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'MISSING_CURRENCY',
            'Currency is required when updating amount',
        );
    }

    // Validate amount precision against currency
    if (update.amount !== undefined && update.currency !== undefined) {
        try {
            validateAmountPrecision(update.amount, update.currency);
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
        }
    }

    return update;
};

export const validateSettlementId = (value: unknown): SettlementId => {
    const result = settlementIdSchema.safeParse(value);
    if (!result.success) {
        const [issue] = result.error.issues;
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'INVALID_SETTLEMENT_ID',
            issue.message,
        );
    }

    return toSettlementId(result.data);
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
