import {
    CreateGroupRequest,
    CreateGroupRequestSchema,
    GroupId,
    GroupPermissions,
    MemberRoles,
    PermissionLevels,
    UpdateDisplayNameRequest,
    UpdateDisplayNameRequestSchema,
    UpdateGroupRequest,
    UpdateGroupRequestSchema,
} from '@splitifyd/shared';
import { toGroupId, toGroupName } from '@splitifyd/shared';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { sanitizeString } from '../utils/security';
import { parseWithApiError } from '../utils/validation';

/**
 * Validate create group request
 */
export const validateCreateGroup = (body: unknown): CreateGroupRequest => {
    return parseWithApiError(CreateGroupRequestSchema, body, {
        name: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
        description: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
    });
};

/**
 * Validate update group request
 */
export const validateUpdateGroup = (body: unknown): UpdateGroupRequest => {
    return parseWithApiError(UpdateGroupRequestSchema, body, {
        name: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
        description: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
    });
};

/**
 * Validate update display name request
 */
export const validateUpdateDisplayName = (body: unknown): UpdateDisplayNameRequest => {
    const maybeObject = typeof body === 'object' && body !== null ? body as Record<string, unknown> : undefined;
    const preSanitizedBody = maybeObject
        ? {
            ...maybeObject,
            displayName: typeof maybeObject.displayName === 'string'
                ? sanitizeString(maybeObject.displayName).trim()
                : maybeObject.displayName,
        }
        : body;

    const parsed = parseWithApiError(UpdateDisplayNameRequestSchema, preSanitizedBody, {
        displayName: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
    });

    return {
        displayName: sanitizeString(parsed.displayName).trim(),
    };
};

/**
 * Validate group ID
 */
export const validateGroupId = (id: unknown): GroupId => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'group ID is required');
    }

    return toGroupId(id.trim());
};

/**
 * Sanitize group data for safe storage
 */
export const sanitizeGroupData = <T extends CreateGroupRequest | UpdateGroupRequest>(data: T): T => {
    const sanitized: any = {};

    if ('name' in data && data.name) {
        sanitized.name = toGroupName(sanitizeString(data.name as string));
    }

    if ('description' in data && data.description !== undefined) {
        sanitized.description = sanitizeString(data.description);
    }

    // Handle members array if present
    if ('members' in data && data.members) {
        sanitized.members = data.members;
    }

    return sanitized as T;
};

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

export const validateUpdateGroupPermissionsRequest = (body: unknown): UpdateGroupPermissionsRequest => {
    return parseWithApiError(UpdateGroupPermissionsSchema, body, {
        expenseEditing: { code: 'INVALID_INPUT', message: 'Invalid expense editing permission' },
        expenseDeletion: { code: 'INVALID_INPUT', message: 'Invalid expense deletion permission' },
        memberInvitation: { code: 'INVALID_INPUT', message: 'Invalid member invitation permission' },
        memberApproval: { code: 'INVALID_INPUT', message: 'Invalid member approval requirement' },
        settingsManagement: { code: 'INVALID_INPUT', message: 'Invalid settings management permission' },
    }) as UpdateGroupPermissionsRequest;
};

export const validateUpdateMemberRoleRequest = (body: unknown): UpdateMemberRoleRequestBody => {
    return parseWithApiError(UpdateMemberRoleSchema, body, {
        role: {
            code: 'INVALID_INPUT',
            message: 'Invalid member role',
        },
    });
};

export const validateMemberId = (memberId: unknown): string => {
    if (!memberId || typeof memberId !== 'string' || memberId.trim().length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'member ID is required');
    }
    return memberId.trim();
};
