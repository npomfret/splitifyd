import type { GroupMember, MemberRole, MemberStatus, UserThemeColor } from '@splitifyd/shared';
import { MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { generateShortId, randomChoice } from '../test-helpers';
import { ThemeBuilder } from './ThemeBuilder';

/**
 * Builder for creating GroupMember objects for tests
 * GroupMember is a composite view type (User + GroupMembership) used in API responses
 */
export class GroupMemberBuilder {
    private member: GroupMember;

    constructor() {
        const uid = `user-${generateShortId()}`;
        const displayName = randomChoice(['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince', 'Eve Anderson']);

        this.member = {
            // User identification
            uid,
            displayName,
            email: `${uid}@test.com`,
            initials: this.generateInitials(displayName),

            // User display properties
            photoURL: null,
            themeColor: new ThemeBuilder().build(),

            // Group membership metadata
            memberRole: MemberRoles.MEMBER,
            memberStatus: MemberStatuses.ACTIVE,
            joinedAt: new Date().toISOString(),
        };
    }

    // User identification methods
    withUid(uid: string): this {
        this.member.uid = uid;
        // Update email to match UID if it was auto-generated
        if (this.member.email.endsWith('@test.com')) {
            this.member.email = `${uid}@test.com`;
        }
        return this;
    }

    withDisplayName(displayName: string): this {
        this.member.displayName = displayName;
        // Auto-update initials when display name changes
        this.member.initials = this.generateInitials(displayName);
        return this;
    }

    withEmail(email: string): this {
        this.member.email = email;
        return this;
    }

    withInitials(initials: string): this {
        this.member.initials = initials;
        return this;
    }

    // User display properties methods
    withPhotoURL(photoURL: string | null): this {
        this.member.photoURL = photoURL;
        return this;
    }

    withThemeColor(themeColor: UserThemeColor): this {
        this.member.themeColor = themeColor;
        return this;
    }

    withTheme(themeColor: UserThemeColor): this {
        return this.withThemeColor(themeColor);
    }

    // Group membership metadata methods
    withMemberRole(role: MemberRole): this {
        this.member.memberRole = role;
        return this;
    }

    withRole(role: MemberRole): this {
        return this.withMemberRole(role);
    }

    withMemberStatus(status: MemberStatus): this {
        this.member.memberStatus = status;
        return this;
    }

    withStatus(status: MemberStatus): this {
        return this.withMemberStatus(status);
    }

    withJoinedAt(joinedAt: string | Date): this {
        this.member.joinedAt = typeof joinedAt === 'string' ? joinedAt : joinedAt.toISOString();
        return this;
    }

    withInvitedBy(invitedBy: string): this {
        this.member.invitedBy = invitedBy;
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
    private generateInitials(displayName: string): string {
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
            .withDisplayName(`User ${uid.slice(0, 4)}`)
            .withEmail(`${uid}@test.com`);
    }

    /**
     * Create an admin member
     */
    static admin(uid: string = `admin-${generateShortId()}`): GroupMemberBuilder {
        return new GroupMemberBuilder().withUid(uid).withDisplayName('Admin User').asAdmin();
    }

    /**
     * Create multiple members with sequential IDs
     */
    static buildMany(count: number, customizer?: (builder: GroupMemberBuilder, index: number) => void): GroupMember[] {
        return Array.from({ length: count }, (_, i) => {
            const builder = new GroupMemberBuilder().withUid(`user-${i + 1}`).withDisplayName(`User ${i + 1}`);

            if (customizer) {
                customizer(builder, i);
            }

            return builder.build();
        });
    }
}
