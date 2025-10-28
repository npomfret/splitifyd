import { getGroupDisplayName } from '@/utils/displayName';
import { describe, expect, it } from 'vitest';

describe('getGroupDisplayName', () => {
    it('returns group display name when available', () => {
        const result = getGroupDisplayName({ groupDisplayName: 'Scout Leader' });
        expect(result).toBe('Scout Leader');
    });

    it('trims whitespace from group display name', () => {
        const result = getGroupDisplayName({ groupDisplayName: '  Fire Team  ' });
        expect(result).toBe('Fire Team');
    });

    it('throws when group display name is missing', () => {
        expect(() => getGroupDisplayName({ groupDisplayName: '' })).toThrow(
            'Expected groupDisplayName to be set',
        );
    });

    it('throws when member data is null', () => {
        expect(() => getGroupDisplayName(null)).toThrow('Group member data is required');
    });

    it('throws when member data is undefined', () => {
        expect(() => getGroupDisplayName(undefined)).toThrow('Group member data is required');
    });
});
