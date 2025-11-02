import { type Amount } from '@splitifyd/shared';
import {
    AcceptanceBooleanSchema,
    type AcceptanceMessages,
    type AmountSchemaOptions,
    createAmountSchema,
    createDisplayNameSchema,
    createPaginationSchema,
    createPasswordSchema,
    createUtcDateSchema,
    CurrencyCodeSchema,
    DisplayNameSchema,
    type DisplayNameSchemaOptions,
    EmailSchema,
    type PaginationSchemaOptions,
    type PasswordMessages,
    PhoneNumberSchema,
    type UtcDateSchemaOptions,
} from '@splitifyd/shared';
import { z } from 'zod';
import { validateAmountPrecision } from '../../utils/amount-validation';

export interface CurrencyPrecisionParams {
    amount: string;
    currency?: string | null;
    path?: (string | number)[];
    ctx: z.RefinementCtx;
}

export const ensureCurrencyPrecision = ({ amount, currency, path, ctx }: CurrencyPrecisionParams) => {
    if (!currency) {
        return;
    }

    try {
        validateAmountPrecision(amount as Amount, currency);
    } catch (error) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: (error as Error).message,
            path: path ?? ['amount'],
        });
    }
};

export {
    AcceptanceBooleanSchema,
    type AcceptanceMessages,
    type AmountSchemaOptions,
    createAmountSchema,
    createDisplayNameSchema,
    createPaginationSchema,
    createPasswordSchema,
    createUtcDateSchema,
    CurrencyCodeSchema,
    DisplayNameSchema,
    type DisplayNameSchemaOptions,
    EmailSchema,
    type PaginationSchemaOptions,
    type PasswordMessages,
    PhoneNumberSchema,
    type UtcDateSchemaOptions,
};
