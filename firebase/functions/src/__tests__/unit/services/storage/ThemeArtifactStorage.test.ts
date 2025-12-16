import { describe, expect, it } from 'vitest';
import { computeSha256 } from '../../../../services/storage/ThemeArtifactStorage';

describe('ThemeArtifactStorage utilities', () => {
    it('computes stable SHA-256 hashes', () => {
        const value = computeSha256('hello world');
        const sameValue = computeSha256('hello world');
        const differentValue = computeSha256('goodbye');

        expect(value).toBe(sameValue);
        expect(value).toMatch(/^[a-f0-9]{64}$/);
        expect(differentValue).not.toBe(value);
    });
});
