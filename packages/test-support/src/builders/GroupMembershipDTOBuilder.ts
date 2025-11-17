import type {DisplayName, GroupId, GroupMembershipDTO, ISOString, MemberRole, MemberStatus, UserId, UserThemeColor} from '@splitifyd/shared';
import { MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { convertToISOString, generateShortId, randomChoice } from '../test-helpers';
import { ThemeBuilder } from './ThemeBuilder';
import {toDisplayName} from "@splitifyd/shared";

/**
 * Builder for creating GroupMembershipDTO objects for tests
 * GroupMembershipDTO represents the membership document stored in Firestore
 */
export class GroupMembershipDTOBuilder {
    private membership: GroupMembershipDTO;

    constructor() {
        const uid = `user-${generateShortId()}`;
        const displayName = toDisplayName(randomChoice(['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince', 'Eve Anderson']));

        this.membership = {
            uid,
            groupId: toGroupId(`group-${generateShortId()}`),
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
            joinedAt: convertToISOString(new Date()),
            theme: new ThemeBuilder().build(),
            groupDisplayName: displayName,
        };
    }

    withUid(uid: UserId): this {
        this.membership.uid = uid;
        return this;
    }

    withGroupId(groupId: GroupId | string): this {
        this.membership.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withMemberRole(role: MemberRole): this {
        this.membership.memberRole = role;
        return this;
    }

    withRole(role: MemberRole): this {
        return this.withMemberRole(role);
    }

    withMemberStatus(status: MemberStatus): this {
        this.membership.memberStatus = status;
        return this;
    }

    withStatus(status: MemberStatus): this {
        return this.withMemberStatus(status);
    }

    withJoinedAt(timestamp: Date | string | ISOString): this {
        this.membership.joinedAt = convertToISOString(timestamp);
        return this;
    }

    withInvitedBy(invitedBy: UserId): this {
        this.membership.invitedBy = invitedBy;
        return this;
    }

    withTheme(theme: UserThemeColor): this {
        this.membership.theme = theme;
        return this;
    }

    withGroupDisplayName(groupDisplayName: DisplayName | string): this {
        this.membership.groupDisplayName = typeof groupDisplayName === "string" ? toDisplayName(groupDisplayName) : groupDisplayName;
        return this;
    }

    // Helper methods for common scenarios
    asAdmin(): this {
        this.membership.memberRole = MemberRoles.ADMIN;
        return this;
    }

    asMember(): this {
        this.membership.memberRole = MemberRoles.MEMBER;
        return this;
    }

    asViewer(): this {
        this.membership.memberRole = MemberRoles.VIEWER;
        return this;
    }

    asPending(): this {
        this.membership.memberStatus = MemberStatuses.PENDING;
        return this;
    }

    asActive(): this {
        this.membership.memberStatus = MemberStatuses.ACTIVE;
        return this;
    }

    asArchived(): this {
        this.membership.memberStatus = MemberStatuses.ARCHIVED;
        return this;
    }

    build(): GroupMembershipDTO {
        return { ...this.membership };
    }

    /**
     * Create a minimal membership with just required fields
     */
    static minimal(uid: UserId, groupId: GroupId): GroupMembershipDTOBuilder {
        return new GroupMembershipDTOBuilder()
            .withUid(uid)
            .withGroupId(groupId);
    }

    /**
     * Create a pending membership (common for testing approval flows)
     */
    static pending(uid: UserId, groupId: GroupId, invitedBy: UserId): GroupMembershipDTOBuilder {
        return new GroupMembershipDTOBuilder()
            .withUid(uid)
            .withGroupId(groupId)
            .withInvitedBy(invitedBy)
            .asPending();
    }

    /**
     * Create an admin membership
     */
    static admin(uid: UserId, groupId: GroupId): GroupMembershipDTOBuilder {
        return new GroupMembershipDTOBuilder()
            .withUid(uid)
            .withGroupId(groupId)
            .asAdmin();
    }
}
