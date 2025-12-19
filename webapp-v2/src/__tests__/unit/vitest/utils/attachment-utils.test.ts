import { formatFileSize, isImage, urlNeedsAuthentication } from '@/utils/attachment-utils';
import { describe, expect, it } from 'vitest';

describe('isImage', () => {
    it('returns true for image content types', () => {
        expect(isImage('image/jpeg')).toBe(true);
        expect(isImage('image/png')).toBe(true);
        expect(isImage('image/webp')).toBe(true);
        expect(isImage('image/heic')).toBe(true);
    });

    it('returns false for non-image content types', () => {
        expect(isImage('application/pdf')).toBe(false);
        expect(isImage('text/plain')).toBe(false);
        expect(isImage('video/mp4')).toBe(false);
    });
});

describe('formatFileSize', () => {
    it('formats bytes', () => {
        expect(formatFileSize(500)).toBe('500 B');
        expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats kilobytes', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(2048)).toBe('2 KB');
        expect(formatFileSize(1536)).toBe('2 KB'); // rounds
    });

    it('formats megabytes', () => {
        expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
        expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
});

describe('urlNeedsAuthentication', () => {
    describe('URLs that need authentication', () => {
        it('returns true for /api/ paths', () => {
            expect(urlNeedsAuthentication('/api/groups/123/attachments/456')).toBe(true);
            expect(urlNeedsAuthentication('/api/users/me')).toBe(true);
        });

        it('returns true for paths containing /attachments/', () => {
            expect(urlNeedsAuthentication('/groups/123/attachments/456')).toBe(true);
            expect(urlNeedsAuthentication('https://example.com/attachments/file.jpg')).toBe(true);
        });
    });

    describe('URLs that do not need authentication', () => {
        it('returns false for data URLs', () => {
            expect(urlNeedsAuthentication('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
            expect(urlNeedsAuthentication('data:text/plain,Hello')).toBe(false);
        });

        it('returns false for blob URLs', () => {
            expect(urlNeedsAuthentication('blob:http://localhost:3000/abc-123')).toBe(false);
            expect(urlNeedsAuthentication('blob:null/def-456')).toBe(false);
        });

        it('returns false for external https URLs without attachments path', () => {
            expect(urlNeedsAuthentication('https://example.com/image.jpg')).toBe(false);
            expect(urlNeedsAuthentication('https://cdn.example.com/assets/logo.png')).toBe(false);
        });

        it('returns false for relative paths without api or attachments', () => {
            expect(urlNeedsAuthentication('/images/logo.png')).toBe(false);
            expect(urlNeedsAuthentication('/static/file.pdf')).toBe(false);
        });
    });
});
