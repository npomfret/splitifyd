import { CreateSettlementRequest, UpdateSettlementRequest, toSettlementId, type SettlementId, toGroupId, toISOString } from '@splitifyd/shared';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { validateAmountPrecision } from '../utils/amount-validation';
import { ApiError } from '../utils/errors';
import {
    createAmountSchema,
    createRequestValidator,
    createUtcDateSchema,
    createZodErrorMapper,
    CurrencyCodeSchema,
    sanitizeInputString,
} from '../validation/common';

const noteSchema = z
    .union([
        z
            .string()
            .trim()
            .max(500, 'Note cannot exceed 500 characters'),
        z.literal(''),
    ])
    .optional();

const settlementDateSchema = z
    .union([
        createUtcDateSchema(),
        z.null(),
    ])
    .optional();

export const createSettlementSchema = z
    .object({
        groupId: z.string().trim().min(1, 'Group ID is required'),
        payerId: z.string().trim().min(1, 'Payer ID is required'),
        payeeId: z.string().trim().min(1, 'Payee ID is required'),
        amount: createAmountSchema(),
        currency: CurrencyCodeSchema,
        date: settlementDateSchema,
        note: noteSchema,
    })
    .superRefine((value, ctx) => {
        if (value.payerId && value.payeeId && value.payerId === value.payeeId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['payeeId'],
                message: 'Payer and payee cannot be the same person',
            });
        }

        if (value.amount && value.currency) {
            try {
                validateAmountPrecision(value.amount, value.currency);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['amount'],
                    message: (error as Error).message,
                });
            }
        }
    });

export const updateSettlementSchema = z
    .object({
        amount: createAmountSchema().optional(),
        currency: CurrencyCodeSchema.optional(),
        date: settlementDateSchema,
        note: noteSchema,
    })
    .superRefine((value, ctx) => {
        if (
            value.amount === undefined &&
            value.currency === undefined &&
            value.date === undefined &&
            value.note === undefined
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'At least one field must be provided for update',
            });
        }

        if (value.amount !== undefined && value.currency !== undefined) {
            try {
                validateAmountPrecision(value.amount, value.currency);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['amount'],
                    message: (error as Error).message,
                });
            }
        }
    });

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
    schema: createSettlementSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const date =
            value.date === null || value.date === undefined ? undefined : value.date;
        const note =
            value.note === undefined ? undefined : sanitizeInputString(value.note);

        return {
            groupId: toGroupId(value.groupId.trim()),
            payerId: value.payerId.trim(),
            payeeId: value.payeeId.trim(),
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
    schema: updateSettlementSchema,
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

export const settlementIdSchema = z
    .string()
    .trim()
    .min(1, 'Settlement ID cannot be empty');

export const validateCreateSettlement = (body: unknown): CreateSettlementRequest => {
    return baseValidateCreateSettlement(body);
};

export const validateUpdateSettlement = (body: unknown): UpdateSettlementRequest => {
    return baseValidateUpdateSettlement(body);
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

export const schemas = {
    createSettlementSchema,
    updateSettlementSchema,
    settlementIdSchema,
};
