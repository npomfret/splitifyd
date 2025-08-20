import type { GroupMember, UserThemeColor } from '../../../shared/shared-types';
import type { ColorPattern } from '../../../constants/user-colors';

export class GroupMemberBuilder {
    private member: GroupMember;

    constructor() {
        // Default member with sensible defaults
        this.member = {
            joinedAt: new Date().toISOString(),
            role: 'member',
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

    withRole(role: 'owner' | 'member'): this {
        this.member.role = role;
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

    asOwner(): this {
        this.member.role = 'owner';
        return this;
    }

    asMember(): this {
        this.member.role = 'member';
        return this;
    }

    build(): GroupMember {
        return { ...this.member, theme: { ...this.member.theme } };
    }
}