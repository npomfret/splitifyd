import { GroupMember, UserThemeColor, MemberRoles, MemberStatuses } from '../../../shared/shared-types';
import type { ColorPattern } from '../../../constants/user-colors';

export class GroupMemberBuilder {
    private member: GroupMember;

    constructor() {
        // Default member with sensible defaults
        this.member = {
            joinedAt: new Date().toISOString(),
            role: MemberRoles.MEMBER,
            status: MemberStatuses.ACTIVE,
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

    withJoinedAt(joinedAt: string): this {
        this.member.joinedAt = joinedAt;
        return this;
    }

    withRole(role: 'admin' | 'member' | 'viewer'): this {
        this.member.role = role as any;
        return this;
    }

    withStatus(status: 'active' | 'pending'): this {
        this.member.status = status as any;
        return this;
    }

    withTheme(theme: Partial<UserThemeColor>): this {
        this.member.theme = { ...this.member.theme, ...theme };
        return this;
    }

    withThemeColors(light: string, dark: string, name: string): this {
        this.member.theme.light = light;
        this.member.theme.dark = dark;
        this.member.theme.name = name;
        return this;
    }

    withPattern(pattern: ColorPattern): this {
        this.member.theme.pattern = pattern;
        return this;
    }

    withColorIndex(colorIndex: number): this {
        this.member.theme.colorIndex = colorIndex;
        return this;
    }

    asAdmin(): this {
        this.member.role = MemberRoles.ADMIN;
        return this;
    }

    asMember(): this {
        this.member.role = MemberRoles.MEMBER;
        return this;
    }

    asViewer(): this {
        this.member.role = MemberRoles.VIEWER;
        return this;
    }

    asPending(): this {
        this.member.status = MemberStatuses.PENDING;
        return this;
    }

    build(): GroupMember {
        return { ...this.member, theme: { ...this.member.theme } };
    }
}