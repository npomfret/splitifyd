/**
 * Central Schema Index - Unified exports for all Zod schemas
 *
 * This file provides a single import point for all Zod schemas used throughout
 * the application. After the DTO migration, most application code should use
 * DTOs from @billsplit-wl/shared. Document schemas are for internal Firestore I/O only.
 *
 * IMPORTANT:
 * - **Application Layer**: Use DTOs from @billsplit-wl/shared (e.g., ExpenseDTO, GroupDTO)
 * - **Firestore I/O Layer**: Use Document schemas (e.g., ExpenseDocumentSchema) - INTERNAL ONLY
 *
 * Usage:
 * ```typescript
 * // Application code - use DTOs
 * import type { ExpenseDTO, GroupDTO } from '@billsplit-wl/shared';
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
// Services should import DTOs from @billsplit-wl/shared instead.

// Comment schemas
export { CommentDataSchema, CommentDocumentSchema } from './comment';

// Activity feed schemas
export { type ActivityFeedDocument, ActivityFeedDocumentSchema } from './activity-feed';

// Expense schemas
export { ExpenseDocumentSchema, ExpenseReadDocumentSchema } from './expense';

// Settlement schemas
export { SettlementDocumentSchema } from './settlement';

// ShareLink schemas
export { type ParsedShareLink, ShareLinkDataSchema, ShareLinkDocumentSchema } from './sharelink';

// User schemas
export { type UserDocument, UserDocumentSchema } from './user';

// Policy schemas
export { PolicyDocumentSchema } from './policy';

// Group schemas
export { GroupDocumentSchema, GroupReadDocumentSchema } from './group';

// Group membership schemas
export { TopLevelGroupMemberSchema } from './group-membership';

// Tenant schemas
export { TenantDocumentSchema, TenantImageDocumentSchema } from './tenant';

// ==========================================
// VALIDATION UTILITIES
// ==========================================
export { validateUpdate } from './validation-helpers';

// ==========================================
// BALANCE CALCULATION SCHEMAS
// ==========================================
// These schemas validate application-layer data (DTOs with ISO strings)
export { type ParsedCurrencyBalances } from './balance';

// ==========================================
// GROUP BALANCE SCHEMAS
// ==========================================
// Schemas for pre-computed group balances stored in Firestore
export { GroupBalanceDocumentSchema, type GroupBalanceDTO } from './group-balance';
