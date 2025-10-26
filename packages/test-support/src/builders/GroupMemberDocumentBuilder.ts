import { ColorPattern, GroupMembershipDTO, MemberRoles, MemberStatuses, UserThemeColor } from '@splitifyd/shared';
import { GroupId, UserId } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Builder for GroupMembershipDTO - the membership document DTO
 * Used for testing membership operations
 *
 * Note: Internally uses Timestamp for convenience, but build() returns DTOs with ISO strings
 */
export class GroupMemberDocumentBuilder {
    private memberDoc: any;

    constructor() {
        // Default member document with sensible defaults
        const now = Timestamp.now();
        this.memberDoc = {
            uid: 'default-user-id',
            groupId: 'default-group-id',
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
            joinedAt: now,
            invitedBy: 'default-inviter',
            groupDisplayName: 'Default User', // Custom display name for this group
            theme: {
                light: '#1f5582',
                dark: '#4a9eff',
                name: 'Ocean Blue',
                pattern: 'solid',
                assignedAt: now,
                colorIndex: 0,
            },
            // Required audit fields per TopLevelGroupMemberSchema
            groupUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
        };
    }

    withUserId(userId: UserId): this {
        this.memberDoc.uid = userId;
        return this;
    }

    withGroupId(groupId: GroupId): this {
        this.memberDoc.groupId = groupId;
        return this;
    }

    withRole(role: 'admin' | 'member' | 'viewer'): this {
        this.memberDoc.memberRole = role as any;
        return this;
    }

    withStatus(status: 'active' | 'pending' | 'archived'): this {
        this.memberDoc.memberStatus = status as any;
        return this;
    }

    withJoinedAt(joinedAt: string | Timestamp | Date): this {
        if (typeof joinedAt === 'string') {
            this.memberDoc.joinedAt = Timestamp.fromDate(new Date(joinedAt));
        } else if (joinedAt instanceof Date) {
            this.memberDoc.joinedAt = Timestamp.fromDate(joinedAt);
        } else {
            this.memberDoc.joinedAt = joinedAt;
        }
        return this;
    }

    withInvitedBy(invitedBy: UserId): this {
        this.memberDoc.invitedBy = invitedBy;
        return this;
    }

    withGroupDisplayName(groupDisplayName: string): this {
        this.memberDoc.groupDisplayName = groupDisplayName;
        return this;
    }

    withTheme(theme: Partial<UserThemeColor>): this {
        this.memberDoc.theme = { ...this.memberDoc.theme, ...theme };
        return this;
    }

    withThemeColors(light: string, dark: string, name: string): this {
        this.memberDoc.theme.light = light;
        this.memberDoc.theme.dark = dark;
        this.memberDoc.theme.name = name;
        return this;
    }

    withColorIndex(colorIndex: number): this {
        this.memberDoc.theme.colorIndex = colorIndex;
        return this;
    }

    withPattern(pattern: ColorPattern): this {
        this.memberDoc.theme.pattern = pattern;
        return this;
    }

    asAdmin(): this {
        this.memberDoc.memberRole = MemberRoles.ADMIN;
        return this;
    }

    asMember(): this {
        this.memberDoc.memberRole = MemberRoles.MEMBER;
        return this;
    }

    asViewer(): this {
        this.memberDoc.memberRole = MemberRoles.VIEWER;
        return this;
    }

    asPending(): this {
        this.memberDoc.memberStatus = MemberStatuses.PENDING;
        return this;
    }

    asActive(): this {
        this.memberDoc.memberStatus = MemberStatuses.ACTIVE;
        return this;
    }

    build(): GroupMembershipDTO {
        // Convert all Timestamp fields to ISO strings for DTO
        return {
            ...this.memberDoc,
            joinedAt: this.memberDoc.joinedAt.toDate().toISOString(),
            groupDisplayName: this.memberDoc.groupDisplayName,
            theme: {
                ...this.memberDoc.theme,
                assignedAt: this.memberDoc.theme.assignedAt.toDate().toISOString(),
            },
            groupUpdatedAt: this.memberDoc.groupUpdatedAt.toDate().toISOString(),
            createdAt: this.memberDoc.createdAt.toDate().toISOString(),
            updatedAt: this.memberDoc.updatedAt.toDate().toISOString(),
        };
    }

    buildDocument(): any {
        return { ...this.memberDoc, theme: { ...this.memberDoc.theme } };
    }
}
