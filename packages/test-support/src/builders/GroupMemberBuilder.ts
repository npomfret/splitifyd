import { GroupMember, MemberRoles, MemberStatuses, MemberRole, MemberStatus } from '@splitifyd/shared';
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

    withRole(role: MemberRole): this {
        this.member.memberRole = role;
        return this;
    }

    withStatus(status: MemberStatus): this {
        this.member.memberStatus = status;
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
