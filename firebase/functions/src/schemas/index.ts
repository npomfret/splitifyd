/**
 * Central Schema Index - Unified exports for all Firestore document validation schemas
 *
 * This file provides a single import point for all Zod schemas used for Firestore
 * document validation. It standardizes naming conventions and ensures consistency
 * across the codebase.
 *
 * Usage:
 * ```typescript
 * import { ExpenseDocumentSchema, GroupDocumentSchema } from '../schemas';
 * ```
 */

// Common schema fragments and utilities
export {
    CurrencyCodeSchema,
    UserIdSchema,
    GroupIdSchema,
    createDocumentSchemas,
} from './common';

// Comment schemas
export { CommentDocumentSchema, CommentDataSchema, type ParsedComment, type CommentData } from './comment';

// Expense schemas
export { ExpenseDocumentSchema, ExpenseSplitSchema, type ExpenseDocument } from './expense';

// Settlement schemas
export { SettlementDocumentSchema, type SettlementDocument } from './settlement';

// ShareLink schemas
export { ShareLinkDocumentSchema, ShareLinkDataSchema, type ParsedShareLink, type ShareLinkData } from './sharelink';

// User schemas
export { UserDocumentSchema, UserDataSchema, type UserDocument, type UserData } from './user';

// Policy schemas
export { PolicyDocumentSchema, PolicyDataSchema, type PolicyDocument, type PolicyData } from './policy';

// Group schemas
export { GroupDocumentSchema, GroupDataSchema, GroupMemberDocumentSchema, type GroupDocument, type GroupData, type ParsedGroupMemberDocument } from './group';

// Group membership schemas
export { TopLevelGroupMemberSchema, type ParsedTopLevelGroupMemberDocument } from './group-membership';

// Validation monitoring and utilities - only export what's actually used
export { EnhancedValidationError } from './validation-monitor';

export { validateBeforeWrite, validateUpdate } from './validation-helpers';

// Change tracking schemas
export { TransactionChangeDocumentSchema, BalanceChangeDocumentSchema, type TransactionChangeDocument, type BalanceChangeDocument } from './change-documents';

// Balance calculation schemas
export {
    BalanceCalculationResultSchema,
    BalanceCalculationInputSchema,
    BalanceDisplaySchema,
    CurrencyBalanceDisplaySchema,
    type ParsedBalanceCalculationResult,
    type ParsedBalanceCalculationInput,
    type ParsedCurrencyBalances,
} from './balance';
