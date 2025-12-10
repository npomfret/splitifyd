import { toExpenseLabel } from '@billsplit-wl/shared';
import { z } from 'zod';
import { AuditFieldsSchema, createDocumentSchemas, FirestoreTimestampSchema } from './common';

/**
 * Base Group schema without document ID
 *
 * Groups contain metadata about the expense-sharing group including
 * permissions and security settings. Members are stored in subcollections.
 */
/**
 * Currency settings schema for group-level currency restrictions
 */
const GroupCurrencySettingsSchema = z
    .object({
        permitted: z.array(z.string().length(3)).nonempty(),
        default: z.string().length(3),
    })
    .refine((data) => data.permitted.includes(data.default), {
        message: 'Default currency must be in permitted list',
        path: ['default'],
    });

/**
 * Schema for recently used labels map (label -> Firestore Timestamp)
 * Keys are ExpenseLabel branded strings, values are Firestore Timestamps
 */
const RecentlyUsedLabelsSchema = z.record(
    z.string().transform(toExpenseLabel),
    FirestoreTimestampSchema,
);

const BaseGroupSchema = z
    .object({
        name: z.string().min(1, 'Group name is required'),
        description: z.string().optional(),
        permissions: z
            .object({
                expenseEditing: z.string(),
                expenseDeletion: z.string(),
                memberInvitation: z.string(),
                memberApproval: z.union([z.literal('automatic'), z.literal('admin-required')]),
                settingsManagement: z.string(),
            })
            .strict(),
        currencySettings: GroupCurrencySettingsSchema.nullable().optional(),
        recentlyUsedLabels: RecentlyUsedLabelsSchema.optional(),
        deletedAt: FirestoreTimestampSchema.nullable(),
    })
    .merge(AuditFieldsSchema)
    .strict();

/**
 * Create Document and Data schemas using common pattern
 */
const { DocumentSchema: GroupDocumentSchema, ReadDocumentSchema: GroupReadDocumentSchema } = createDocumentSchemas(BaseGroupSchema);

/**
 * Zod schemas for group document validation
 *
 * Usage:
 * ```typescript
 * // For reading groups (tolerates extra fields from schema evolution)
 * const group = GroupReadDocumentSchema.parse({...doc.data(), id: doc.id});
 *
 * // For writing groups (strict validation)
 * const group = GroupDocumentSchema.parse(data);
 * ```
 */
export { GroupDocumentSchema, GroupReadDocumentSchema };
