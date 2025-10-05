/**
 * Central Schema Index - Unified exports for all Zod schemas
 *
 * This file provides a single import point for all Zod schemas used throughout
 * the application. After the DTO migration, most application code should use
 * DTOs from @splitifyd/shared. Document schemas are for internal Firestore I/O only.
 *
 * IMPORTANT:
 * - **Application Layer**: Use DTOs from @splitifyd/shared (e.g., ExpenseDTO, GroupDTO)
 * - **Firestore I/O Layer**: Use Document schemas (e.g., ExpenseDocumentSchema) - INTERNAL ONLY
 *
 * Usage:
 * ```typescript
 * // Application code - use DTOs
 * import type { ExpenseDTO, GroupDTO } from '@splitifyd/shared';
 *
 * // Firestore Reader/Writer - use Document schemas for validation
 * import { ExpenseDocumentSchema, GroupDocumentSchema } from '../schemas';
 * ```
 */

// ==========================================
// DOCUMENT SCHEMAS (Internal Firestore I/O)
// ==========================================
// These schemas validate Firestore Timestamp objects at the storage boundary.
// Used ONLY by FirestoreReader and FirestoreWriter for internal validation.

// ==========================================
// DOCUMENT SCHEMAS ONLY (No Document Types)
// ==========================================
// After DTO migration, Document types are internal to FirestoreReader/Writer.
// Services should import DTOs from @splitifyd/shared instead.

// Comment schemas
export { CommentDocumentSchema, CommentDataSchema, type ParsedComment } from './comment';

// Expense schemas
export { ExpenseDocumentSchema } from './expense';

// Settlement schemas
export { SettlementDocumentSchema } from './settlement';

// ShareLink schemas
export { ShareLinkDocumentSchema, ShareLinkDataSchema, type ParsedShareLink } from './sharelink';

// User schemas
export { UserDocumentSchema, UserDataSchema } from './user';

// Policy schemas - Note: PolicyVersionDocument still exported for specific use case
export { PolicyDocumentSchema, PolicyDataSchema, type PolicyVersionDocument } from './policy';

// Group schemas - Note: ParsedGroupMemberDocument removed, use GroupMembershipDTO from @splitifyd/shared
export { GroupDocumentSchema, GroupDataSchema, GroupMemberDocumentSchema } from './group';

// Group membership schemas
export { TopLevelGroupMemberSchema } from './group-membership';

// ==========================================
// VALIDATION UTILITIES
// ==========================================
export { validateUpdate } from './validation-helpers';

// ==========================================
// BALANCE CALCULATION SCHEMAS
// ==========================================
// These schemas validate application-layer data (DTOs with ISO strings)
export {
    BalanceCalculationResultSchema,
    BalanceCalculationInputSchema,
    BalanceDisplaySchema,
    CurrencyBalanceDisplaySchema,
    type ParsedBalanceCalculationResult,
    type ParsedBalanceCalculationInput,
    type ParsedCurrencyBalances,
} from './balance';
