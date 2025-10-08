import { COLOR_PATTERNS, ColorPattern, GroupMembershipDTO, MemberRoles, MemberStatuses, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
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
        this.memberDoc = {
            uid: 'default-user-id',
            groupId: 'default-group-id',
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
            joinedAt: Timestamp.now(),
            invitedBy: 'default-inviter',
            theme: {
                light: '#1f5582',
                dark: '#4a9eff',
                name: 'Ocean Blue',
                pattern: 'solid',
                assignedAt: new Date().toISOString(),
                colorIndex: 0,
            },
        };
    }

    withUserId(userId: string): this {
        this.memberDoc.uid = userId;
        return this;
    }

    withGroupId(groupId: string): this {
        this.memberDoc.groupId = groupId;
        return this;
    }

    withRole(role: 'admin' | 'member' | 'viewer'): this {
        this.memberDoc.memberRole = role as any;
        return this;
    }

    withStatus(status: 'active' | 'pending'): this {
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

    withInvitedBy(invitedBy: string): this {
        this.memberDoc.invitedBy = invitedBy;
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

    /**
     * Apply theme colors using the same logic as getThemeColorForMember
     */
    withThemeIndex(memberIndex: number): this {
        const colorIndex = memberIndex % USER_COLORS.length;
        const patternIndex = Math.floor(memberIndex / USER_COLORS.length) % COLOR_PATTERNS.length;
        const color = USER_COLORS[colorIndex];
        const pattern = COLOR_PATTERNS[patternIndex];

        this.memberDoc.theme = {
            light: color.light,
            dark: color.dark,
            name: color.name,
            pattern,
            assignedAt: new Date().toISOString(),
            colorIndex,
        };
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
        // Convert Timestamp to ISO string for DTO
        return {
            ...this.memberDoc,
            joinedAt: this.memberDoc.joinedAt.toDate().toISOString(),
            theme: { ...this.memberDoc.theme },
        };
    }

    /**
     * Build as Firestore document with Timestamp (for internal use only)
     * @deprecated Tests should use build() which returns DTOs
     */
    buildDocument(): any {
        return { ...this.memberDoc, theme: { ...this.memberDoc.theme } };
    }
}
