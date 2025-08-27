/**
 * Helper to build a group detail URL pattern
 */
export function groupDetailUrlPattern(groupId?: string): RegExp {
    if (groupId) {
        return new RegExp(`/groups/${groupId}$`);
    }
    return /\/groups\/[a-zA-Z0-9]+$/;
}
