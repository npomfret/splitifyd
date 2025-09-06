import { GroupMember, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { randomChoice, randomDate } from '../test-helpers';

export class GroupMemberBuilder {
    private member: GroupMember;

    constructor() {
        this.member = {
            joinedAt: randomDate(90),
            memberRole: randomChoice([MemberRoles.ADMIN, MemberRoles.MEMBER, MemberRoles.VIEWER]),
            memberStatus: randomChoice([MemberStatuses.ACTIVE, MemberStatuses.PENDING]),
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
