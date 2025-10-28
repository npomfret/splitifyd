import type { GroupMember, GroupMembershipDTO, ISOString, toISOString, UserId, UserThemeColor } from '@splitifyd/shared';
import { TopLevelGroupMemberDocument } from '../types';

/**
 * Creates a top-level membership document from a subcollection membership document
 * @param memberDoc - The original membership DTO (with ISO strings)
 * @param groupUpdatedAt - The group's updatedAt ISO string for denormalization
 * @returns TopLevelGroupMemberDocument ready to be written to top-level collection (without timestamps)
 *
 * Note: This function works with ISO strings throughout - no Timestamp objects.
 * FirestoreWriter will convert ISO strings to Timestamps at the write boundary.
 */
export function createTopLevelMembershipDocument(memberDoc: GroupMembershipDTO | any, groupUpdatedAt: ISOString): Omit<TopLevelGroupMemberDocument, 'createdAt' | 'updatedAt'> {
    return {
        ...memberDoc,
        // groupUpdatedAt is ISO string, FirestoreWriter converts to Timestamp
        groupUpdatedAt,
    };
}

/**
 * Creates a "phantom" GroupMember object for users who have left the group.
 *
 * When a user leaves a group, their historical expenses and settlements still need
 * to be displayed. This function creates a GroupMember representation using their
 * real user profile data (displayName, themeColor) with sentinel values for
 * membership-specific fields that are no longer available.
 *
 * @param userId - The UID of the departed user
 * @param displayName - The user's display name from their profile
 * @param themeColor - Optional theme color from user profile (defaults to neutral gray)
 * @returns GroupMember object suitable for displaying in UI despite user departure
 *
 * Sentinel values used:
 * - memberRole: 'member' (last known role before departure)
 * - memberStatus: 'active' (can't use 'left' - not in MemberStatus enum)
 * - joinedAt: current timestamp (historical data unavailable)
 * - invitedBy: undefined (historical data unavailable)
 * - groupDisplayName: derived from global displayName
 */
export function createPhantomGroupMember(
    userId: UserId,
    displayName: string,
    themeColor?: UserThemeColor,
): GroupMember {
    // Generate initials from display name
    const initials = displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Default neutral gray theme if no theme color provided
    const defaultTheme: UserThemeColor = {
        light: '#9CA3AF',
        dark: '#6B7280',
        name: 'Neutral Gray',
        pattern: 'solid',
        assignedAt: new Date().toISOString() as ReturnType<typeof toISOString>,
        colorIndex: -1,
    };

    return {
        uid: userId,
        initials,
        themeColor: themeColor || defaultTheme,
        memberRole: 'member', // Last known role before departure
        memberStatus: 'active', // Last known status (can't use 'left' - not in enum)
        joinedAt: new Date().toISOString() as ReturnType<typeof toISOString>, // Historical data unavailable
        invitedBy: undefined,
        groupDisplayName: displayName, // Use global displayName for departed members
    };
}
