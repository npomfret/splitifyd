import type { GroupMemberDTO, UserThemeColor, MemberRole, MemberStatus, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { ThemeBuilder } from './ThemeBuilder';

/**
 * Builder for GroupMemberDTO - the API response format for group members
 * Combines user profile data with group membership data
 */
export class GroupMemberDTOBuilder {
    private memberDTO: GroupMemberDTO;

    constructor() {
        // Initialize with default values for all required GroupMemberDTO fields
        this.memberDTO = {
            uid: 'default-user-id',
            displayName: 'Default User',
            email: 'default@example.com',
            initials: 'DU',
            themeColor: new ThemeBuilder().build(),
            photoURL: null,
            joinedAt: new Date().toISOString(),
            memberRole: 'member' as MemberRole,
            memberStatus: 'active' as MemberStatus
        };
    }

    withUid(uid: string): this {
        this.memberDTO.uid = uid;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.memberDTO.displayName = displayName;
        // Auto-generate initials from display name
        const parts = displayName.split(' ');
        this.memberDTO.initials = parts.length > 1
            ? parts[0][0] + parts[parts.length - 1][0]
            : displayName.substring(0, 2);
        return this;
    }

    withEmail(email: string): this {
        this.memberDTO.email = email;
        return this;
    }

    withInitials(initials: string): this {
        this.memberDTO.initials = initials;
        return this;
    }

    withThemeColor(themeColor: UserThemeColor): this {
        this.memberDTO.themeColor = themeColor;
        return this;
    }

    withThemeName(name: string): this {
        this.memberDTO.themeColor = new ThemeBuilder().withName(name).build();
        return this;
    }

    withPhotoURL(photoURL: string | null): this {
        this.memberDTO.photoURL = photoURL;
        return this;
    }

    withJoinedAt(joinedAt: string): this {
        this.memberDTO.joinedAt = joinedAt;
        return this;
    }

    withRole(role: MemberRole): this {
        this.memberDTO.memberRole = role;
        return this;
    }

    asAdmin(): this {
        this.memberDTO.memberRole = 'admin' as MemberRole;
        return this;
    }

    asMember(): this {
        this.memberDTO.memberRole = 'member' as MemberRole;
        return this;
    }

    asViewer(): this {
        this.memberDTO.memberRole = 'viewer' as MemberRole;
        return this;
    }

    withStatus(status: MemberStatus): this {
        this.memberDTO.memberStatus = status;
        return this;
    }

    asActive(): this {
        this.memberDTO.memberStatus = 'active' as MemberStatus;
        return this;
    }

    asPending(): this {
        this.memberDTO.memberStatus = 'pending' as MemberStatus;
        return this;
    }

    withInvitedBy(invitedBy: string): this {
        this.memberDTO.invitedBy = invitedBy;
        return this;
    }

    build(): GroupMemberDTO {
        return { ...this.memberDTO };
    }
}
