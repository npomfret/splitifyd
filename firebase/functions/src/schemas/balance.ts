import { SplitTypes } from '@splitifyd/shared';
import { z } from 'zod';

// Schema for ExpenseSplit (from @splitifyd/shared)
const ExpenseSplitSchema = z.object({
    uid: z.string(),
    amount: z.number(),
    percentage: z.number().optional(),
});

// Schema for ExpenseDTO (from @splitifyd/shared)
const ExpenseDTOSchema = z.object({
    id: z.string(),
    groupId: z.string(),
    createdBy: z.string(),
    paidBy: z.string(),
    amount: z.number(),
    currency: z.string(),
    description: z.string(),
    category: z.string(),
    date: z.string(), // ISO string
    splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
    participants: z.array(z.string()),
    splits: z.array(ExpenseSplitSchema),
    receiptUrl: z.string().optional(),
    deletedAt: z.string().nullable(),
    deletedBy: z.string().nullable(),
    createdAt: z.string(), // ISO string
    updatedAt: z.string(), // ISO string
});

// Schema for SettlementDTO (from @splitifyd/shared)
const SettlementDTOSchema = z.object({
    id: z.string(),
    groupId: z.string(),
    payerId: z.string(),
    payeeId: z.string(),
    amount: z.number(),
    currency: z.string(),
    date: z.string(), // ISO string
    note: z.string().optional(),
    createdBy: z.string(),
    deletedAt: z.string().nullable(),
    deletedBy: z.string().nullable(),
    createdAt: z.string(), // ISO string
    updatedAt: z.string(), // ISO string
});

// Schema for GroupPermissions (from @splitifyd/shared)
const GroupPermissionsSchema = z.object({
    expenseEditing: z.string(),
    expenseDeletion: z.string(),
    memberInvitation: z.string(),
    memberApproval: z.union([z.literal('automatic'), z.literal('admin-required')]),
    settingsManagement: z.string(),
});

// Schema for CurrencyBalance (from @splitifyd/shared)
const CurrencyBalanceSchema = z.object({
    currency: z.string(),
    netBalance: z.number(),
    totalOwed: z.number(),
    totalOwing: z.number(),
});

// Schema for GroupDTO (from @splitifyd/shared)
const GroupDTOSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdBy: z.string(),
    createdAt: z.string(), // ISO string
    updatedAt: z.string(), // ISO string
    securityPreset: z.enum(['open', 'managed', 'custom']),
    presetAppliedAt: z.string().optional(), // ISO string
    permissions: GroupPermissionsSchema,
    balance: z
        .object({
            balancesByCurrency: z.record(z.string(), CurrencyBalanceSchema),
        })
        .optional(), // Computed field - added by API layer
    lastActivity: z.string().optional(),
});

// Schema for UserThemeColor (from @splitifyd/shared)
const UserThemeColorSchema = z.object({
    light: z.string().min(1),
    dark: z.string().min(1),
    name: z.string().min(1),
    pattern: z.string().min(1),
    assignedAt: z.string().datetime(), // ISO string
    colorIndex: z.number(),
});

// Schema for RegisteredUser (from @splitifyd/shared)
// This validates the DTO format used by application layer (ISO strings, not Timestamps)
const RegisteredUserSchema = z.object({
    uid: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().min(1),
    photoURL: z.string().url().nullable().optional(),
    emailVerified: z.boolean().optional(),
    role: z.string().optional(),
    termsAcceptedAt: z.string().datetime().optional(), // ISO string for DTOs
    cookiePolicyAcceptedAt: z.string().datetime().optional(), // ISO string for DTOs
    acceptedPolicies: z.record(z.string(), z.string()).optional(),
    themeColor: UserThemeColorSchema.optional(),
    preferredLanguage: z.string().optional(),
    createdAt: z.string().datetime().optional(), // ISO string for DTOs
    updatedAt: z.string().datetime().optional(), // ISO string for DTOs
});

// Schema for UserBalance (from @splitifyd/shared)
const UserBalanceSchema = z.object({
    uid: z.string(),
    owes: z.record(z.string(), z.number()),
    owedBy: z.record(z.string(), z.number()),
    netBalance: z.number(),
});

// Schema for SimplifiedDebt (from @splitifyd/shared)
const SimplifiedDebtSchema = z.object({
    from: z.object({
        uid: z.string(),
    }),
    to: z.object({
        uid: z.string(),
    }),
    amount: z.number(),
    currency: z.string(),
});

// Schema for CurrencyBalances - record of currency to user balances
const CurrencyBalancesSchema = z.record(
    z.string(), // currency
    z.record(z.string(), UserBalanceSchema), // userId to UserBalance
);

// Schema for BalanceCalculationInput
// This validates application-layer DTOs with ISO strings (not Firestore Documents with Timestamps)
export const BalanceCalculationInputSchema = z.object({
    groupId: z.string(),
    expenses: z.array(ExpenseDTOSchema),
    settlements: z.array(SettlementDTOSchema),
    memberIds: z.array(z.string()),
    groupDoc: GroupDTOSchema,
    memberProfiles: z.record(z.string(), RegisteredUserSchema), // Changed from UserProfileSchema
});

// Schema for BalanceCalculationResult / GroupBalance
// Note: lastUpdated is an ISO string because this validates application-layer DTOs
export const BalanceCalculationResultSchema = z.object({
    groupId: z.string(),
    simplifiedDebts: z.array(SimplifiedDebtSchema),
    lastUpdated: z.string().datetime(), // ISO string for DTOs (converted to Timestamp by FirestoreWriter)
    balancesByCurrency: CurrencyBalancesSchema,
});

// Schema for the currency-specific balance data used in GroupService.addComputedFields
export const CurrencyBalanceDisplaySchema = z.object({
    currency: z.string(),
    netBalance: z.number(),
    totalOwed: z.number(),
    totalOwing: z.number(),
});

// Schema for the balance display data used in GroupService
export const BalanceDisplaySchema = z.object({
    balancesByCurrency: z.record(z.string(), CurrencyBalanceDisplaySchema),
});

// Export inferred types
export type ParsedCurrencyBalances = z.infer<typeof CurrencyBalancesSchema>;
export type ParsedBalanceCalculationInput = z.infer<typeof BalanceCalculationInputSchema>;
export type ParsedBalanceCalculationResult = z.infer<typeof BalanceCalculationResultSchema>;
