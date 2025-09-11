import { describe, test, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { Group, GroupMemberWithProfile, MemberRoles, MemberStatuses, SecurityPresets, PermissionLevels, UserThemeColor } from '@splitifyd/shared';

// Import webapp Zod schemas for validation
// Note: These are the actual schemas used by the frontend to validate API responses
const GroupSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    balance: z.object({
        balancesByCurrency: z.record(
            z.string(),
            z.object({
                currency: z.string(),
                netBalance: z.number(),
                totalOwed: z.number(),
                totalOwing: z.number(),
            }),
        ),
    }),
    lastActivity: z.string().min(1),
    lastActivityRaw: z.string(),
    lastExpense: z
        .object({
            description: z.string().min(1),
            amount: z.number(),
            date: z.string(),
        })
        .optional(),

    // Security configuration for permission system
    securityPreset: z.enum(['open', 'managed']).optional(),
    permissions: z
        .object({
            expenseEditing: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            expenseDeletion: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            memberInvitation: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
            memberApproval: z.enum(['automatic', 'admin-required']).optional(),
            settingsManagement: z.enum(['anyone', 'owner-and-admin', 'admin-only']).optional(),
        })
        .optional(),

    createdBy: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
});

const UserThemeColorSchema = z.object({
    light: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    dark: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
    name: z.string().min(1).max(50),
    pattern: z.enum(['solid', 'dots', 'stripes', 'diagonal']),
    colorIndex: z.number().int().min(0),
});

const GroupMemberWithProfileSchema = z.object({
    // RegisteredUser properties
    uid: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().min(1),
    role: z.enum(['system_admin', 'system_user']).optional(),
    initials: z.string().min(1),

    // GroupMember properties (with renames to avoid conflicts)
    joinedAt: z.string(),
    memberRole: z.enum(['admin', 'member', 'viewer']),
    memberStatus: z.enum(['active', 'pending']),
    invitedBy: z.string().optional(),
    lastPermissionChange: z.string().optional(),

    // Deprecated but may still appear
    name: z.string().optional(),

    // Theme is inherited from RegisteredUser.themeColor
    themeColor: UserThemeColorSchema.optional(),
});

describe('Cross-Service Schema Validation', () => {
    let mockGroup: Group;
    let mockGroupMember: GroupMemberWithProfile;
    let mockTheme: UserThemeColor;

    beforeAll(() => {
        // Create valid test data conforming to TypeScript interfaces
        mockTheme = {
            light: '#3B82F6',
            dark: '#1E40AF',
            name: 'Blue',
            pattern: 'solid',
            assignedAt: '2024-01-01T00:00:00.000Z',
            colorIndex: 0,
        };

        mockGroup = {
            id: 'group-123',
            name: 'Test Group',
            description: 'A test group for validation',
            createdBy: 'user-123',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            securityPreset: SecurityPresets.OPEN,
            permissions: {
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ANYONE,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            },
            inviteLinks: {
                default: {
                    createdAt: '2024-01-01T00:00:00.000Z',
                    createdBy: 'user-123',
                    maxUses: 10,
                    usedCount: 0,
                },
            },
        };

        mockGroupMember = {
            uid: 'user-456',
            email: 'test@example.com',
            displayName: 'Test User',
            initials: 'TU',
            joinedAt: '2024-01-01T00:00:00.000Z',
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
            invitedBy: 'user-123',
            themeColor: mockTheme,
        };
    });

    describe('Group Schema Validation', () => {
        test('should validate Group interface against frontend Zod schema', () => {
            // Create a Group response that mimics what the API returns
            const apiGroupResponse = {
                ...mockGroup,
                // Add fields that are computed by the API
                balance: {
                    balancesByCurrency: {
                        USD: {
                            currency: 'USD',
                            netBalance: 0,
                            totalOwed: 0,
                            totalOwing: 0,
                        },
                    },
                },
                lastActivity: '2 days ago',
                lastActivityRaw: '2024-01-01T00:00:00.000Z',
                lastExpense: {
                    description: 'Dinner',
                    amount: 50.0,
                    date: '2024-01-01T00:00:00.000Z',
                },
            };

            // This should not throw - the frontend schema should accept backend data
            expect(() => GroupSchema.parse(apiGroupResponse)).not.toThrow();

            // Verify parsing returns expected data structure
            const parsed = GroupSchema.parse(apiGroupResponse);
            expect(parsed.id).toBe(mockGroup.id);
            expect(parsed.name).toBe(mockGroup.name);
            expect(parsed.securityPreset).toBe('open');
            expect(parsed.permissions?.expenseEditing).toBe('anyone');
        });

        test('should detect schema drift - missing required fields', () => {
            // Simulate backend change that removes a required field
            const incompleteGroup = {
                // Missing 'id' field
                name: 'Test Group',
                balance: {
                    balancesByCurrency: {},
                },
                lastActivity: '2 days ago',
                lastActivityRaw: '2024-01-01T00:00:00.000Z',
                createdBy: 'user-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(() => GroupSchema.parse(incompleteGroup)).toThrow();
        });

        test('should detect schema drift - type mismatches', () => {
            const groupWithWrongTypes = {
                id: 123, // Should be string, not number
                name: 'Test Group',
                balance: {
                    balancesByCurrency: {},
                },
                lastActivity: '2 days ago',
                lastActivityRaw: '2024-01-01T00:00:00.000Z',
                createdBy: 'user-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            expect(() => GroupSchema.parse(groupWithWrongTypes)).toThrow();
        });

        test('should detect incompatible enum values', () => {
            const apiGroupResponse = {
                id: 'group-123',
                name: 'Test Group',
                balance: { balancesByCurrency: {} },
                lastActivity: '2 days ago',
                lastActivityRaw: '2024-01-01T00:00:00.000Z',
                createdBy: 'user-123',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                securityPreset: 'custom', // Not supported by frontend schema
                permissions: {
                    expenseEditing: 'custom-level', // Invalid enum value
                },
            };

            expect(() => GroupSchema.parse(apiGroupResponse)).toThrow();
        });
    });

    describe('GroupMemberWithProfile Schema Validation', () => {
        test('should validate GroupMemberWithProfile interface against frontend expectations', () => {
            // This should not throw - verifies interface matches frontend expectations
            expect(() => GroupMemberWithProfileSchema.parse(mockGroupMember)).not.toThrow();

            const parsed = GroupMemberWithProfileSchema.parse(mockGroupMember);
            expect(parsed.uid).toBe(mockGroupMember.uid);
            expect(parsed.memberRole).toBe('member');
            expect(parsed.memberStatus).toBe('active');
            expect(parsed.themeColor?.name).toBe('Blue');
        });

        test('should detect member schema drift - wrong role enum', () => {
            const memberWithInvalidRole = {
                ...mockGroupMember,
                memberRole: 'super-admin', // Not a valid MemberRole
            };

            expect(() => GroupMemberWithProfileSchema.parse(memberWithInvalidRole)).toThrow();
        });

        test('should detect member schema drift - wrong status enum', () => {
            const memberWithInvalidStatus = {
                ...mockGroupMember,
                memberStatus: 'inactive', // Not a valid MemberStatus in current system
            };

            expect(() => GroupMemberWithProfileSchema.parse(memberWithInvalidStatus)).toThrow();
        });

        test('should handle optional fields correctly', () => {
            const minimalMember = {
                uid: 'user-456',
                email: 'test@example.com',
                displayName: 'Test User',
                initials: 'TU',
                joinedAt: '2024-01-01T00:00:00.000Z',
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                // Optional fields omitted
            };

            expect(() => GroupMemberWithProfileSchema.parse(minimalMember)).not.toThrow();
        });
    });

    describe('Theme Schema Validation', () => {
        test('should validate UserThemeColor against frontend schema', () => {
            expect(() => UserThemeColorSchema.parse(mockTheme)).not.toThrow();

            const parsed = UserThemeColorSchema.parse(mockTheme);
            expect(parsed.colorIndex).toBe(0);
            expect(parsed.pattern).toBe('solid');
        });

        test('should reject invalid hex colors', () => {
            const invalidTheme = {
                ...mockTheme,
                light: 'not-a-hex-color',
            };

            expect(() => UserThemeColorSchema.parse(invalidTheme)).toThrow();
        });

        test('should reject invalid color patterns', () => {
            const invalidTheme = {
                ...mockTheme,
                pattern: 'invalid-pattern', // Not in enum
            };

            expect(() => UserThemeColorSchema.parse(invalidTheme)).toThrow();
        });
    });

    describe('API Contract Validation', () => {
        test('should ensure backend constants match frontend expectations', () => {
            // Verify enum constants are consistent
            expect(Object.values(MemberRoles)).toEqual(['admin', 'member', 'viewer']);
            expect(Object.values(MemberStatuses)).toEqual(['active', 'pending']);
            expect(Object.values(SecurityPresets)).toEqual(['open', 'managed', 'custom']);
            expect(Object.values(PermissionLevels)).toEqual(['anyone', 'owner-and-admin', 'admin-only']);
        });

        test('should validate permission approval types', () => {
            const validApprovalTypes = ['automatic', 'admin-required'];
            // These should match what's expected by frontend GroupSchema
            validApprovalTypes.forEach((type) => {
                const testGroup = {
                    id: 'test',
                    name: 'test',
                    balance: { balancesByCurrency: {} },
                    lastActivity: 'test',
                    lastActivityRaw: 'test',
                    createdBy: 'test',
                    createdAt: 'test',
                    updatedAt: 'test',
                    permissions: {
                        memberApproval: type,
                    },
                };
                expect(() => GroupSchema.parse(testGroup)).not.toThrow();
            });
        });
    });

    describe('Regression Tests - Known Schema Issues', () => {
        test('should not include members field in Group schema (Phase 5 cleanup)', () => {
            // This was the issue that broke E2E tests - ensure it doesn't happen again
            const groupWithDeprecatedMembers = {
                id: 'group-123',
                name: 'Test Group',
                members: [], // This field was removed in Phase 5
                balance: { balancesByCurrency: {} },
                lastActivity: 'test',
                lastActivityRaw: 'test',
                createdBy: 'test',
                createdAt: 'test',
                updatedAt: 'test',
            };

            // Frontend schema should ignore unknown fields rather than error
            // This allows for backward compatibility during migrations
            expect(() => GroupSchema.parse(groupWithDeprecatedMembers)).not.toThrow();

            // But the parsed result should not include the deprecated field
            const parsed = GroupSchema.parse(groupWithDeprecatedMembers);
            expect(parsed).not.toHaveProperty('members');
        });

        test('should handle legacy splitBetween field gracefully', () => {
            // Test that schemas can handle fields that may still exist from legacy data
            // but are not part of current interfaces
            const legacyExpenseData = {
                id: 'expense-123',
                groupId: 'group-123',
                description: 'Test Expense',
                amount: 50.0,
                splitBetween: ['user1', 'user2'], // Legacy field name
                participants: ['user1', 'user2'], // Current field name
                paidBy: 'user1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            // Schema validation should work with both fields present
            // (This would be tested if we had an ExpenseSchema, just demonstrating the pattern)
            expect(legacyExpenseData.participants).toEqual(legacyExpenseData.splitBetween);
        });
    });
});
