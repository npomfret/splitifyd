import { describe, expect, it } from 'vitest';
import { getExtensionForContentType, validateCommentAttachment, validateReceiptUpload } from '../../../../utils/validation/attachmentValidation';

describe('attachmentValidation', () => {
    // Real magic number bytes for each format
    const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const WEBP_MAGIC = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // File size (placeholder)
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
    ]);
    const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

    function createValidBuffer(magic: Buffer, size: number): Buffer {
        const buffer = Buffer.alloc(size);
        magic.copy(buffer);
        return buffer;
    }

    describe('validateReceiptUpload', () => {
        describe('size validation', () => {
            it('should accept file under 10MB', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 5 * 1024 * 1024); // 5MB
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should accept file exactly at 10MB', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 10 * 1024 * 1024); // 10MB
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should reject file over 10MB', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 10 * 1024 * 1024 + 1); // 10MB + 1 byte
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).toThrow();
            });

            it('should reject empty file', () => {
                const buffer = Buffer.alloc(0);
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).toThrow();
            });
        });

        describe('content type validation', () => {
            it('should accept image/jpeg', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should accept image/png', () => {
                const buffer = createValidBuffer(PNG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'image/png')).not.toThrow();
            });

            it('should accept image/webp', () => {
                const buffer = createValidBuffer(WEBP_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'image/webp')).not.toThrow();
            });

            it('should reject application/pdf for receipts', () => {
                const buffer = createValidBuffer(PDF_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'application/pdf')).toThrow();
            });

            it('should reject missing content type', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, undefined)).toThrow();
            });

            it('should handle content type with charset parameter', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'image/jpeg; charset=utf-8')).not.toThrow();
            });

            it('should handle uppercase content type', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'IMAGE/JPEG')).not.toThrow();
            });

            it('should reject unsupported image types', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'image/gif')).toThrow();
                expect(() => validateReceiptUpload(buffer, 'image/bmp')).toThrow();
                expect(() => validateReceiptUpload(buffer, 'image/tiff')).toThrow();
            });

            it('should reject non-image types', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'text/plain')).toThrow();
                expect(() => validateReceiptUpload(buffer, 'application/json')).toThrow();
            });
        });

        describe('magic number validation', () => {
            it('should reject file with wrong magic number for declared type', () => {
                // File has PNG magic but claims to be JPEG
                const buffer = createValidBuffer(PNG_MAGIC, 1000);
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).toThrow();
            });

            it('should reject corrupted file (no valid magic number)', () => {
                const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).toThrow();
            });

            it('should reject file too short for magic number check', () => {
                const buffer = Buffer.from([0xff, 0xd8]); // Only 2 bytes, JPEG needs 3
                expect(() => validateReceiptUpload(buffer, 'image/jpeg')).toThrow();
            });
        });
    });

    describe('validateCommentAttachment', () => {
        describe('size validation', () => {
            it('should accept file under 5MB', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 2 * 1024 * 1024); // 2MB
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should accept file exactly at 5MB', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 5 * 1024 * 1024); // 5MB
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should reject file over 5MB', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 5 * 1024 * 1024 + 1); // 5MB + 1 byte
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).toThrow();
            });

            it('should reject empty file', () => {
                const buffer = Buffer.alloc(0);
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).toThrow();
            });
        });

        describe('content type validation', () => {
            it('should accept image/jpeg', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should accept image/png', () => {
                const buffer = createValidBuffer(PNG_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/png')).not.toThrow();
            });

            it('should accept image/webp', () => {
                const buffer = createValidBuffer(WEBP_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/webp')).not.toThrow();
            });

            it('should accept application/pdf for comment attachments', () => {
                const buffer = createValidBuffer(PDF_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'application/pdf')).not.toThrow();
            });

            it('should reject missing content type', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, undefined)).toThrow();
            });

            it('should reject unsupported types', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/gif')).toThrow();
                expect(() => validateCommentAttachment(buffer, 'text/plain')).toThrow();
                expect(() => validateCommentAttachment(buffer, 'application/zip')).toThrow();
            });
        });

        describe('magic number validation', () => {
            it('should validate JPEG magic number', () => {
                const buffer = createValidBuffer(JPEG_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should validate PNG magic number', () => {
                const buffer = createValidBuffer(PNG_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/png')).not.toThrow();
            });

            it('should validate WebP magic number including WEBP marker', () => {
                const buffer = createValidBuffer(WEBP_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/webp')).not.toThrow();
            });

            it('should reject WebP with RIFF header but no WEBP marker', () => {
                // RIFF header without WEBP marker (could be WAV, AVI, etc)
                const buffer = Buffer.from([
                    0x52,
                    0x49,
                    0x46,
                    0x46, // RIFF
                    0x00,
                    0x00,
                    0x00,
                    0x00, // File size
                    0x57,
                    0x41,
                    0x56,
                    0x45, // WAVE (not WEBP)
                ]);
                expect(() => validateCommentAttachment(buffer, 'image/webp')).toThrow();
            });

            it('should validate PDF magic number', () => {
                const buffer = createValidBuffer(PDF_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'application/pdf')).not.toThrow();
            });

            it('should reject content type mismatch', () => {
                // PDF file claiming to be JPEG
                const buffer = createValidBuffer(PDF_MAGIC, 1000);
                expect(() => validateCommentAttachment(buffer, 'image/jpeg')).toThrow();
            });
        });
    });

    describe('getExtensionForContentType', () => {
        it('should return jpg for image/jpeg', () => {
            expect(getExtensionForContentType('image/jpeg')).toBe('jpg');
        });

        it('should return png for image/png', () => {
            expect(getExtensionForContentType('image/png')).toBe('png');
        });

        it('should return webp for image/webp', () => {
            expect(getExtensionForContentType('image/webp')).toBe('webp');
        });

        it('should return pdf for application/pdf', () => {
            expect(getExtensionForContentType('application/pdf')).toBe('pdf');
        });

        it('should handle uppercase content type', () => {
            expect(getExtensionForContentType('IMAGE/JPEG')).toBe('jpg');
        });

        it('should return bin for unknown content type', () => {
            expect(getExtensionForContentType('application/octet-stream')).toBe('bin');
            expect(getExtensionForContentType('text/plain')).toBe('bin');
        });
    });
});
