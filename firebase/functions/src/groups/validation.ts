import {
    CreateGroupRequest,
    CreateGroupRequestSchema,
    GroupFullDetailsQuerySchema,
    GroupPermissions,
    ListGroupsQuerySchema,
    MemberRoles,
    type MemberStatus,
    MemberStatuses,
    PermissionLevels,
    toDisplayName,
    toGroupName,
    UpdateDisplayNameRequest,
    UpdateDisplayNameRequestSchema,
    UpdateGroupRequest,
    UpdateGroupRequestSchema,
} from '@billsplit-wl/shared';
import { z } from 'zod';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString, validateGroupId, validateGroupIdParam, validateMemberId } from '../validation/common';

// Re-export centralized ID validators for backward compatibility
export { validateGroupId, validateGroupIdParam, validateMemberId };

// ========================================================================
// Error Mappers
// ========================================================================

const createGroupErrorMapper = createZodErrorMapper(
    {
        name: {
            code: 'INVALID_GROUP_NAME',
            message: () => 'Group name is required',
        },
        groupDisplayName: {
            code: 'INVALID_DISPLAY_NAME',
            message: () => 'Display name is required',
        },
        description: {
            code: 'INVALID_DESCRIPTION',
            message: (issue) => issue.message,
        },
        currency: {
            code: 'INVALID_CURRENCY',
            message: () => 'Currency must be a valid 3-letter code',
        },
        members: {
            code: 'INVALID_MEMBERS',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const updateGroupErrorMapper = createZodErrorMapper(
    {
        name: {
            code: 'INVALID_GROUP_NAME',
            message: (issue) => issue.message,
        },
        description: {
            code: 'INVALID_DESCRIPTION',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const updateDisplayNameErrorMapper = createZodErrorMapper(
    {
        displayName: {
            code: 'INVALID_DISPLAY_NAME',
            message: () => 'Display name is required',
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const updatePermissionsErrorMapper = createZodErrorMapper(
    {
        expenseEditing: {
            code: 'INVALID_PERMISSION',
            message: () => 'Invalid expense editing permission',
        },
        expenseDeletion: {
            code: 'INVALID_PERMISSION',
            message: () => 'Invalid expense deletion permission',
        },
        memberInvitation: {
            code: 'INVALID_PERMISSION',
            message: () => 'Invalid member invitation permission',
        },
        memberApproval: {
            code: 'INVALID_PERMISSION',
            message: () => 'Invalid member approval requirement',
        },
        settingsManagement: {
            code: 'INVALID_PERMISSION',
            message: () => 'Invalid settings management permission',
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const updateMemberRoleErrorMapper = createZodErrorMapper(
    {
        role: {
            code: 'INVALID_ROLE',
            message: () => 'Invalid member role',
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

// ========================================================================
// Validators
// ========================================================================

/**
 * Validate create group request
 */
export const validateCreateGroup = createRequestValidator({
    schema: CreateGroupRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        name: toGroupName(sanitizeInputString(value.name)),
        groupDisplayName: toDisplayName(sanitizeInputString(value.groupDisplayName).trim()),
        description: value.description ? sanitizeInputString(value.description) : undefined,
    }),
    mapError: createGroupErrorMapper,
}) as (body: unknown) => CreateGroupRequest;

/**
 * Validate update group request
 */
export const validateUpdateGroup = createRequestValidator({
    schema: UpdateGroupRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const update: UpdateGroupRequest = {};

        if (value.name !== undefined) {
            update.name = toGroupName(sanitizeInputString(value.name));
        }

        if (value.description !== undefined) {
            update.description = sanitizeInputString(value.description);
        }

        return update;
    },
    mapError: updateGroupErrorMapper,
}) as (body: unknown) => UpdateGroupRequest;

/**
 * Validate update display name request
 */
export const validateUpdateDisplayName = createRequestValidator({
    schema: UpdateDisplayNameRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        displayName: toDisplayName(sanitizeInputString(value.displayName).trim()),
    }),
    mapError: updateDisplayNameErrorMapper,
}) as (body: unknown) => UpdateDisplayNameRequest;

// ========================================================================
// Permission Schemas
// ========================================================================

const ExpensePermissionSchema = z.enum([
    PermissionLevels.ANYONE,
    PermissionLevels.OWNER_AND_ADMIN,
    PermissionLevels.ADMIN_ONLY,
]);
const MemberInvitationPermissionSchema = z.enum([PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY]);
const SettingsManagementPermissionSchema = z.enum([PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY]);
const MemberApprovalSchema = z.enum(['automatic', 'admin-required']);

const UpdateGroupPermissionsSchema = z
    .object({
        expenseEditing: ExpensePermissionSchema.optional(),
        expenseDeletion: ExpensePermissionSchema.optional(),
        memberInvitation: MemberInvitationPermissionSchema.optional(),
        memberApproval: MemberApprovalSchema.optional(),
        settingsManagement: SettingsManagementPermissionSchema.optional(),
    })
    .refine((value) => Object.values(value).some((v) => v !== undefined), {
        message: 'At least one permission must be provided',
    });

const UpdateMemberRoleSchema = z.object({
    role: z.nativeEnum(MemberRoles),
});

type UpdateGroupPermissionsRequest = Partial<GroupPermissions>;
type UpdateMemberRoleRequestBody = z.infer<typeof UpdateMemberRoleSchema>;

/**
 * Validate update group permissions request
 */
export const validateUpdateGroupPermissionsRequest = createRequestValidator({
    schema: UpdateGroupPermissionsSchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: updatePermissionsErrorMapper,
}) as (body: unknown) => UpdateGroupPermissionsRequest;

/**
 * Validate update member role request
 */
export const validateUpdateMemberRoleRequest = createRequestValidator({
    schema: UpdateMemberRoleSchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: updateMemberRoleErrorMapper,
}) as (body: unknown) => UpdateMemberRoleRequestBody;

// ========================================================================
// List Query Validators
// ========================================================================

const listGroupsQueryErrorMapper = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
        order: {
            code: 'INVALID_QUERY_PARAMS',
            message: () => 'Order must be "asc" or "desc"',
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

export interface ListGroupsQueryResult {
    limit: number;
    cursor: string | undefined;
    order: 'asc' | 'desc';
    statusFilter?: MemberStatus | MemberStatus[];
}

/**
 * Validate list groups query parameters.
 * Parses statusFilter from comma-separated string to MemberStatus array.
 */
const baseValidateListGroupsQuery = createRequestValidator({
    schema: ListGroupsQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: listGroupsQueryErrorMapper,
});

export const validateListGroupsQuery = (query: unknown): ListGroupsQueryResult => {
    const value = baseValidateListGroupsQuery(query);

    let statusFilter: MemberStatus | MemberStatus[] | undefined;

    if (value.statusFilter) {
        const allowedStatuses = new Set<string>(Object.values(MemberStatuses));
        const uniqueStatuses = [
            ...new Set(
                value
                    .statusFilter
                    .split(',')
                    .map((s: string) => s.trim().toLowerCase())
                    .filter((s: string) => s.length > 0 && allowedStatuses.has(s)),
            ),
        ] as MemberStatus[];

        if (uniqueStatuses.length === 1) {
            statusFilter = uniqueStatuses[0];
        } else if (uniqueStatuses.length > 1) {
            statusFilter = uniqueStatuses;
        }
    }

    return {
        limit: value.limit,
        cursor: value.cursor,
        order: value.order,
        statusFilter,
    };
};

const groupFullDetailsQueryErrorMapper = createZodErrorMapper(
    {
        expenseLimit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
        settlementLimit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
        commentLimit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

export interface GroupFullDetailsQueryResult {
    expenseLimit: number;
    expenseCursor?: string;
    settlementLimit: number;
    settlementCursor?: string;
    commentLimit: number;
    commentCursor?: string;
    includeDeletedExpenses: boolean;
    includeDeletedSettlements: boolean;
}

/**
 * Validate group full details query parameters.
 */
export const validateGroupFullDetailsQuery = createRequestValidator({
    schema: GroupFullDetailsQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: groupFullDetailsQueryErrorMapper,
}) as (query: unknown) => GroupFullDetailsQueryResult;
