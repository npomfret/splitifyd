import type { GroupMember, MemberRole, MemberStatus, UserThemeColor } from '@splitifyd/shared';
import { MemberRoles, MemberStatuses, UserId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { ISOString } from '@splitifyd/shared';
import { convertToISOString, generateShortId, randomChoice } from '../test-helpers';
import { ThemeBuilder } from './ThemeBuilder';
import {toDisplayName} from "@splitifyd/shared";

/**
 * Builder for creating GroupMember objects for tests
 * GroupMember is a composite view type (User + GroupMembership) used in API responses
 */
export class GroupMemberBuilder {
    private member: GroupMember;

    constructor() {
        const uid = `user-${generateShortId()}`;
        const displayName = toDisplayName(randomChoice(['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince', 'Eve Anderson']));

        this.member = {
            // User identification
            uid,
            initials: this.generateInitials(displayName),

            // User display properties
            themeColor: new ThemeBuilder()
                .build(),

            // Group membership metadata
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
            joinedAt: convertToISOString(new Date()),
            groupDisplayName: displayName, // Defaults to user's display name (set on join)
        };
    }

    // User identification methods
    withUid(uid: string): this {
        this.member.uid = uid;
        return this;
    }

    withDisplayName(displayName: DisplayName | string): this {
        const converted = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        this.member.groupDisplayName = converted;
        // Auto-update initials when display name changes
        this.member.initials = this.generateInitials(converted);
        return this;
    }

    withInitials(initials: string): this {
        this.member.initials = initials;
        return this;
    }
    withThemeColor(themeColor: UserThemeColor): this {
        this.member.themeColor = themeColor;
        return this;
    }

    withTheme(themeColor: UserThemeColor): this {
        return this
            .withThemeColor(themeColor);
    }

    // Group membership metadata methods
    withMemberRole(role: MemberRole): this {
        this.member.memberRole = role;
        return this;
    }

    withRole(role: MemberRole): this {
        return this
            .withMemberRole(role);
    }

    withMemberStatus(status: MemberStatus): this {
        this.member.memberStatus = status;
        return this;
    }

    withStatus(status: MemberStatus): this {
        return this
            .withMemberStatus(status);
    }

    withJoinedAt(timestamp: Date | string | ISOString): this {
        this.member.joinedAt = convertToISOString(timestamp);
        return this;
    }

    withInvitedBy(invitedBy: UserId): this {
        this.member.invitedBy = invitedBy;
        return this;
    }

    withGroupDisplayName(groupDisplayName: DisplayName | string): this {
        this.member.groupDisplayName = typeof groupDisplayName === "string" ? toDisplayName(groupDisplayName) : groupDisplayName;
        return this;
    }

    // Helper methods for common scenarios
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

    asActive(): this {
        this.member.memberStatus = MemberStatuses.ACTIVE;
        return this;
    }

    /**
     * Generate initials from display name
     * Examples: "Alice Smith" -> "AS", "Bob" -> "B"
     */
    private generateInitials(displayName: DisplayName): string {
        const parts = displayName.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    build(): GroupMember {
        return { ...this.member };
    }

    /**
     * Create a minimal member with just required fields (useful for testing edge cases)
     */
    static minimal(uid: string): GroupMemberBuilder {
        return new GroupMemberBuilder()
            .withUid(uid)
            .withDisplayName(`User ${uid.slice(0, 4)}`);
    }

    /**
     * Create an admin member
     */
    static admin(uid: string = `admin-${generateShortId()}`): GroupMemberBuilder {
        return new GroupMemberBuilder()
            .withUid(uid)
            .withDisplayName('Admin User')
            .asAdmin();
    }
}
