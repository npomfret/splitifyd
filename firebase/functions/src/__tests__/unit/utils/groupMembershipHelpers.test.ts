import { describe, expect, it } from 'vitest';
import { createPhantomGroupMember } from '../../../utils/groupMembershipHelpers';

describe('groupMembershipHelpers', () => {
    describe('createPhantomGroupMember', () => {
        it('applies a neutral gray theme for departed members', () => {
            const phantom = createPhantomGroupMember('user-123', 'Test User');

            expect(phantom.themeColor.light).toBe('#9CA3AF');
            expect(phantom.themeColor.dark).toBe('#6B7280');
            expect(phantom.themeColor.pattern).toBe('solid');
            expect(phantom.themeColor.colorIndex).toBe(-1);
            expect(phantom.initials).toBe('TU');
        });

        it('emits ISO timestamps for theme assignment and join time', () => {
            const phantom = createPhantomGroupMember('user-456', 'Solo');

            expect(Number.isNaN(Date.parse(phantom.joinedAt))).toBe(false);
            expect(Number.isNaN(Date.parse(phantom.themeColor.assignedAt))).toBe(false);
        });
    });
});
