import { DisplayName, toDisplayName } from '@splitifyd/shared';

interface DisplayNameSource {
    displayName?: string | null;
    groupDisplayName?: string | null;
}

/**
 * Returns the group display name for a member.
 *
 * STRICT MODE: All members MUST have groupDisplayName set.
 * If it's missing, this indicates a data integrity issue that must be fixed.
 */
export function getGroupDisplayName(source: DisplayNameSource | null | undefined): DisplayName {
    if (!source) {
        throw new Error('Group member data is required');
    }

    const groupName = typeof source.groupDisplayName === 'string' ? source.groupDisplayName.trim() : '';
    if (!groupName) {
        throw new Error('Expected groupDisplayName to be set. All group members must have a group display name.');
    }

    return toDisplayName(groupName);
}
