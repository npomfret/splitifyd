import { GroupMember, UserThemeColor, MemberRoles, MemberStatuses, ColorPattern } from '@splitifyd/shared';

export class GroupMemberBuilder {
    private member: GroupMember;

    constructor() {
        // Default member with sensible defaults
        this.member = {
            joinedAt: new Date().toISOString(),
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
        };
    }

    withJoinedAt(joinedAt: string): this {
        this.member.joinedAt = joinedAt;
        return this;
    }

    withRole(role: 'admin' | 'member' | 'viewer'): this {
        this.member.memberRole = role as any;
        return this;
    }

    withStatus(status: 'active' | 'pending'): this {
        this.member.memberStatus = status as any;
        return this;
    }

    asAdmin(): this {
        this.member.memberRole = MemberRoles.ADMIN;
        return this;
    }

    asMember(): this {
        this.member.memberRole = MemberRoles.MEMBER;
        return this;
    }

    asViewer(): this {
        this.member.memberRole = MemberRoles.VIEWER;
        return this;
    }

    asPending(): this {
        this.member.memberStatus = MemberStatuses.PENDING;
        return this;
    }

    build(): GroupMember {
        return { ...this.member };
    }
}
