import { ApiErrorResponseSchema, responseSchemas, USD } from '@billsplit-wl/shared';
import { GroupDTOBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';

const groupDetailSchema = responseSchemas['/groups/:groupId'];
const groupListSchema = responseSchemas['GET /groups'];
const groupMembersSchema = responseSchemas['/groups/:groupId/members'];

const buildGroupResponse = () => {
    const group = new GroupDTOBuilder()
        .withId('group-123')
        .withName('Weekend Adventurers')
        .withDescription('Sample group used for schema validation tests')
        .withCreatedBy('user-123')
        .withCreatedAt('2024-01-01T00:00:00.000Z')
        .withUpdatedAt('2024-01-02T00:00:00.000Z')
        .withPermissions({
            expenseEditing: 'anyone',
            expenseDeletion: 'owner-and-admin',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'admin-only',
        })
        .build();

    return {
        id: group.id,
        name: group.name,
        description: group.description,
        balance: {
            balancesByCurrency: {
                USD: {
                    currency: USD,
                    netBalance: '25.00',
                    owes: { 'user-456': '12.50' },
                },
            },
        },
        lastActivity: group.lastActivity,
        lastExpense: {
            description: 'Dinner',
            amount: '42.50',
            date: '2024-01-03T00:00:00.000Z',
        },
        permissions: group.permissions,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
    };
};

const buildMember = () => {
    const member = new GroupMemberBuilder()
        .withUid('user-456')
        .withDisplayName('Test User')
        .withGroupDisplayName('Test User')
        .withInitials('TU')
        .withMemberRole('member')
        .withMemberStatus('active')
        .withJoinedAt('2024-01-01T00:00:00.000Z')
        .withInvitedBy('user-123')
        .build();

    return {
        uid: member.uid,
        groupDisplayName: member.groupDisplayName,
        initials: member.initials,
        themeColor: member.themeColor,
        memberRole: member.memberRole,
        memberStatus: member.memberStatus,
        joinedAt: member.joinedAt,
        invitedBy: member.invitedBy,
    };
};

describe('Shared schema validation', () => {
    it('accepts a valid group detail payload', () => {
        const validPayload = buildGroupResponse();
        expect(() => groupDetailSchema.parse(validPayload)).not.toThrow();
    });

    it('rejects invalid group payloads (amount format)', () => {
        const invalidPayload = buildGroupResponse();
        invalidPayload.lastExpense = {
            ...invalidPayload.lastExpense!,
            amount: 'forty-two dollars',
        };
        expect(() => groupDetailSchema.parse(invalidPayload)).toThrow();
    });

    it('accepts a valid group list response', () => {
        const group = buildGroupResponse();
        const listResponse = {
            groups: [group],
            count: 1,
            hasMore: false,
            nextCursor: undefined,
            pagination: {
                limit: 10,
                order: 'desc',
            },
            metadata: {
                lastChangeTimestamp: 1704067200,
                changeCount: 0,
                serverTime: 1704067200,
            },
        };

        expect(() => groupListSchema.parse(listResponse)).not.toThrow();
    });

    it('accepts a valid group members payload', () => {
        const member = buildMember();
        const membersPayload = {
            members: [member],
            hasMore: false,
            nextCursor: undefined,
        };

        expect(() => groupMembersSchema.parse(membersPayload)).not.toThrow();
    });

    it('rejects group members with unsupported roles', () => {
        const member = {
            ...buildMember(),
            memberRole: 'super-admin',
        };

        const membersPayload = {
            members: [member],
            hasMore: false,
        };

        expect(() => groupMembersSchema.parse(membersPayload)).toThrow();
    });

    it('supports both structured and legacy API error formats', () => {
        const structuredError = {
            error: {
                code: 'INVALID_AMOUNT',
                message: 'Amount must be a positive number',
            },
        };

        const legacyError = {
            error: 'Amount must be a positive number',
            field: 'amount',
        };

        expect(() => ApiErrorResponseSchema.parse(structuredError)).not.toThrow();
        expect(() => ApiErrorResponseSchema.parse(legacyError)).not.toThrow();
    });
});
