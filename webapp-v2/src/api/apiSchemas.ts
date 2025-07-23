/**
 * Zod schemas for runtime validation of API responses
 * 
 * MANDATORY: Every API response must be validated against these schemas
 * This ensures type safety at runtime and catches server contract violations
 */

import { z } from 'zod';

// Base schemas
export const MemberSchema = z.object({
  uid: z.string(),
  name: z.string(),
  initials: z.string(),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
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
  message: z.string()
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
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  memberCount: z.number(),
  balance: z.object({
    userBalance: z.object({
      userId: z.string(),
      name: z.string(),
      owes: z.record(z.string(), z.number()),
      owedBy: z.record(z.string(), z.number()),
      netBalance: z.number()
    }),
    totalOwed: z.number(),
    totalOwing: z.number()
  }),
  lastActivity: z.string(),
  lastActivityRaw: z.string(),
  lastExpense: z.object({
    description: z.string(),
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
  userId: z.string(),
  amount: z.number(),
  percentage: z.number().optional(),
  userName: z.string().optional()
});

export const ExpenseDataSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  description: z.string(),
  amount: z.number(),
  paidBy: z.string(),
  paidByName: z.string().optional(),
  category: z.string(),
  date: z.string(),
  splitType: z.enum(['equal', 'exact', 'percentage']),
  participants: z.array(z.string()),
  splits: z.array(ExpenseSplitSchema),
  createdBy: z.string(),
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

// Balance schemas
export const GroupBalancesSchema = z.object({
  balances: z.array(z.object({
    userId: z.string(),
    userName: z.string(),
    balance: z.number(),
    owes: z.array(z.object({
      userId: z.string(),
      userName: z.string(),
      amount: z.number()
    })),
    owedBy: z.array(z.object({
      userId: z.string(),
      userName: z.string(),
      amount: z.number()
    }))
  })),
  simplifiedDebts: z.array(z.object({
    fromUserId: z.string(),
    fromUserName: z.string(),
    toUserId: z.string(),
    toUserName: z.string(),
    amount: z.number()
  }))
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
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});

// Map of endpoints to their response schemas
export const responseSchemas = {
  '/config': AppConfigurationSchema,
  '/health': HealthCheckResponseSchema,
  '/groups': ListGroupsResponseSchema,
  '/groups/:id': GroupSchema,
  '/expenses': ExpenseDataSchema,
  '/expenses/group': ExpenseListResponseSchema,
  '/groups/balances': GroupBalancesSchema,
  '/groups/share': ShareableLinkResponseSchema,
  '/groups/join': JoinGroupResponseSchema
} as const;

// Helper function to get validator for an endpoint
export function getResponseValidator(endpoint: string) {
  // Handle parameterized routes
  const normalizedEndpoint = endpoint.replace(/\/[^\/]+$/, '/:id');
  return responseSchemas[normalizedEndpoint as keyof typeof responseSchemas];
}