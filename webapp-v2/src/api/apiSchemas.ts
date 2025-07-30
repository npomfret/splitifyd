/**
 * Zod schemas for runtime validation of API responses
 * 
 * MANDATORY: Every API response must be validated against these schemas
 * This ensures type safety at runtime and catches server contract violations
 */

import { z } from 'zod';

// Base schemas
export const MemberSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  initials: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().min(1).optional(),
  joinedAt: z.string().optional()
});

export const FirebaseConfigSchema = z.object({
  apiKey: z.string(),
  authDomain: z.string(),
  projectId: z.string(),
  storageBucket: z.string(),
  messagingSenderId: z.string(),
  appId: z.string(),
  measurementId: z.string().optional()
});

export const ApiConfigSchema = z.object({
  timeout: z.number(),
  retryAttempts: z.number()
});

export const WarningBannerSchema = z.object({
  enabled: z.boolean(),
  message: z.string().min(1)
});

export const EnvironmentConfigSchema = z.object({
  warningBanner: WarningBannerSchema.optional()
});

export const FormDefaultsSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional()
});

// Configuration response
export const AppConfigurationSchema = z.object({
  firebase: FirebaseConfigSchema,
  api: ApiConfigSchema,
  environment: EnvironmentConfigSchema,
  formDefaults: FormDefaultsSchema,
  firebaseAuthUrl: z.string().optional()
});

// Group schemas

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  memberCount: z.number(),
  balance: z.object({
    userBalance: z.object({
      userId: z.string().min(1),
      name: z.string().min(1),
      owes: z.record(z.string(), z.number()),
      owedBy: z.record(z.string(), z.number()),
      netBalance: z.number()
    }).optional(),
    totalOwed: z.number(),
    totalOwing: z.number()
  }),
  lastActivity: z.string().min(1),
  lastActivityRaw: z.string(),
  lastExpense: z.object({
    description: z.string().min(1),
    amount: z.number(),
    date: z.string()
  }).optional(),
  expenseCount: z.number(),
  
  // Optional fields for detail view
  members: z.array(MemberSchema).optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
  memberEmails: z.array(z.string()).optional(),
  lastExpenseTime: z.string().optional()
});

export const ListGroupsResponseSchema = z.object({
  groups: z.array(GroupSchema),
  count: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
  pagination: z.object({
    limit: z.number(),
    order: z.string()
  })
});

// Expense schemas
export const ExpenseSplitSchema = z.object({
  userId: z.string().min(1),
  amount: z.number(),
  percentage: z.number().optional(),
  userName: z.string().min(1).optional()
});

export const ExpenseDataSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  paidBy: z.string().min(1),
  paidByName: z.string().min(1).optional(),
  category: z.string().min(1),
  date: z.string(),
  splitType: z.enum(['equal', 'exact', 'percentage']),
  participants: z.array(z.string().min(1)),
  splits: z.array(ExpenseSplitSchema),
  createdBy: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  receiptUrl: z.string().optional()
});

export const ExpenseListResponseSchema = z.object({
  expenses: z.array(ExpenseDataSchema),
  count: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional()
});

// Balance schemas - Updated to match server response structure
export const UserBalanceSchema = z.object({
  netBalance: z.number(),
  owes: z.record(z.string(), z.number()),
  owedBy: z.record(z.string(), z.number())
});

export const SimplifiedDebtSchema = z.object({
  from: z.string(),
  to: z.string(),
  amount: z.number()
});

export const GroupBalancesSchema = z.object({
  groupId: z.string(),
  userBalances: z.record(z.string(), UserBalanceSchema),
  simplifiedDebts: z.array(SimplifiedDebtSchema),
  lastUpdated: z.string()
});

// Share schemas
export const ShareableLinkResponseSchema = z.object({
  linkId: z.string(),
  shareUrl: z.string(),
  expiresAt: z.string()
});

export const JoinGroupResponseSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  success: z.boolean()
});

// Health check schemas
export const HealthCheckResponseSchema = z.object({
  checks: z.object({
    firestore: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      responseTime: z.number().optional()
    }),
    auth: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      responseTime: z.number().optional()
    })
  })
});

// Error response schema
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional()
  })
});

// Map of endpoints to their response schemas
export const RegisterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().min(1),
  user: z.object({
    uid: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().min(2).max(50)
  })
});

export const responseSchemas = {
  '/config': AppConfigurationSchema,
  '/health': HealthCheckResponseSchema,
  'GET /groups': ListGroupsResponseSchema,
  'POST /groups': GroupSchema,
  '/groups/:id': GroupSchema,
  '/expenses': ExpenseDataSchema,
  '/expenses/group': ExpenseListResponseSchema,
  '/groups/balances': GroupBalancesSchema,
  '/groups/share': ShareableLinkResponseSchema,
  '/groups/join': JoinGroupResponseSchema,
  '/register': RegisterResponseSchema
} as const;