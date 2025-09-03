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
    FirestoreTimestampSchema,
    AuditFieldsSchema,
    OptionalAuditFieldsSchema,
    SoftDeletionFieldsSchema,
    DocumentIdSchema,
    CurrencyCodeSchema,
    UserIdSchema,
    GroupIdSchema,
    createDocumentSchemas,
    SCHEMA_CONFIG,
} from './common';

// Comment schemas
export {
    CommentDocumentSchema,
    CommentDataSchema,
    type ParsedComment,
    type CommentData,
} from './comment';

// Expense schemas
export {
    ExpenseDocumentSchema,
    ExpenseDataSchema,
    ExpenseSplitSchema,
    type ExpenseDocument,
    type ExpenseData,
} from './expense';

// Settlement schemas
export {
    SettlementDocumentSchema,
    SettlementDataSchema,
    type SettlementDocument,
    type SettlementData,
} from './settlement';

// ShareLink schemas
export {
    ShareLinkDocumentSchema,
    ShareLinkDataSchema,
    type ParsedShareLink,
    type ShareLinkData,
} from './sharelink';

// User schemas
export {
    UserDocumentSchema,
    UserDataSchema,
    type UserDocument,
    type UserData,
} from './user';

// Policy schemas
export {
    PolicyDocumentSchema,
    PolicyDataSchema,
    PolicyVersionSchema,
    type PolicyDocument,
    type PolicyData,
    type PolicyVersion,
} from './policy';

// Group schemas
export {
    GroupDocumentSchema,
    GroupDataSchema,
    GroupMemberSchema,
    GroupMemberDocumentSchema,
    type GroupDocument,
    type GroupData,
    type GroupMember,
    type ParsedGroupMemberDocument,
} from './group';

// Validation monitoring and utilities
export {
    validateWithMonitoring,
    validateSafely,
    EnhancedValidationError,
    getValidationMetrics,
    resetValidationMetrics,
    startValidationMetricsLogging,
} from './validation-monitor';

export {
    validateFirestoreDocument,
    validateBeforeWrite,
    validateUpdate,
    monitorValidation,
    validateDocumentBatch,
    createValidatedTransform,
    safeWrite,
} from './validation-helpers';

// Change tracking schemas
export {
    GroupChangeDocumentSchema,
    TransactionChangeDocumentSchema,
    BalanceChangeDocumentSchema,
    type GroupChangeDocument,
    type TransactionChangeDocument,
    type BalanceChangeDocument,
} from './change-documents';

// Balance calculation schemas
export {
    BalanceCalculationResultSchema,
    BalanceCalculationInputSchema,
    CurrencyBalancesSchema,
    UserBalanceSchema,
    SimplifiedDebtSchema,
    BalanceDisplaySchema,
    CurrencyBalanceDisplaySchema,
    ExpenseBalanceSchema,
    SettlementBalanceSchema,
    GroupDataBalanceSchema,
    type ParsedBalanceCalculationResult,
    type ParsedBalanceCalculationInput,
    type ParsedCurrencyBalances,
    type ParsedUserBalance,
    type ParsedSimplifiedDebt,
    type ParsedBalanceDisplay,
    type ParsedCurrencyBalanceDisplay,
    type ParsedExpenseBalance,
    type ParsedSettlementBalance,
    type ParsedGroupDataBalance,
} from './balance';