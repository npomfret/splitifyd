import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { validateFaviconImage, validateImageUpload, validateLogoImage } from '../../../../utils/validation/imageValidation';
import { ErrorCode } from '../../../../errors';

describe('imageValidation', () => {
    describe('validateImageUpload', () => {
        describe('size validation', () => {
            it('should reject empty buffer', () => {
                const buffer = Buffer.from('');

                try {
                    validateImageUpload(buffer, 'image/png');
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });

            it('should reject file exceeding max size', () => {
                const buffer = Buffer.alloc(3 * 1024 * 1024); // 3MB
                const maxSize = 2 * 1024 * 1024; // 2MB limit

                try {
                    validateImageUpload(buffer, 'image/png', { maxSizeBytes: maxSize });
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });

            it('should accept file within size limit', () => {
                const buffer = Buffer.alloc(1 * 1024 * 1024); // 1MB
                const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
                pngHeader.copy(buffer);

                expect(() => validateImageUpload(buffer, 'image/png')).not.toThrow();
            });
        });

        describe('content-type validation', () => {
            it('should reject missing content-type', () => {
                const buffer = Buffer.from('test');

                try {
                    validateImageUpload(buffer, undefined);
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });

            it('should reject invalid content-type', () => {
                const buffer = Buffer.from('test');

                try {
                    validateImageUpload(buffer, 'application/pdf');
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });

            it('should accept valid image content-types', () => {
                const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];

                for (const contentType of validTypes) {
                    const buffer = createValidBuffer(contentType);
                    expect(() => validateImageUpload(buffer, contentType)).not.toThrow();
                }
            });
        });

        describe('magic number validation', () => {
            it('should validate JPEG magic number', () => {
                const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);

                expect(() => validateImageUpload(buffer, 'image/jpeg')).not.toThrow();
            });

            it('should validate PNG magic number', () => {
                const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(100).fill(0)]);

                expect(() => validateImageUpload(buffer, 'image/png')).not.toThrow();
            });

            it('should validate GIF magic number', () => {
                const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(100).fill(0)]);

                expect(() => validateImageUpload(buffer, 'image/gif')).not.toThrow();
            });

            it('should validate WebP magic number', () => {
                const buffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...Array(100).fill(0)]);

                expect(() => validateImageUpload(buffer, 'image/webp')).not.toThrow();
            });

            it('should validate SVG content', () => {
                const buffer = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');

                expect(() => validateImageUpload(buffer, 'image/svg+xml')).not.toThrow();
            });

            it('should validate SVG without XML declaration', () => {
                const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>');

                expect(() => validateImageUpload(buffer, 'image/svg+xml')).not.toThrow();
            });

            it('should reject mismatched content-type and magic number', () => {
                // PNG magic number but claiming to be JPEG
                const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(100).fill(0)]);

                try {
                    validateImageUpload(buffer, 'image/jpeg');
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });

            it('should reject corrupted file with no valid magic number', () => {
                const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);

                try {
                    validateImageUpload(buffer, 'image/png');
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });

            it('should reject invalid SVG content', () => {
                const buffer = Buffer.from('this is not an SVG file');

                try {
                    validateImageUpload(buffer, 'image/svg+xml');
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });
        });

        describe('error codes', () => {
            it('should throw ApiError with correct HTTP status', () => {
                const buffer = Buffer.from('');

                try {
                    validateImageUpload(buffer, 'image/png');
                    expect.fail('Should have thrown');
                } catch (error: any) {
                    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
                    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
                }
            });
        });
    });

    describe('validateLogoImage', () => {
        it('should enforce 2MB limit for logos', () => {
            const buffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5MB

            try {
                validateLogoImage(buffer, 'image/png');
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });

        it('should accept common logo formats', () => {
            const formats = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];

            for (const contentType of formats) {
                const buffer = createValidBuffer(contentType);
                expect(() => validateLogoImage(buffer, contentType)).not.toThrow();
            }
        });

        it('should reject ICO format for logos', () => {
            const buffer = Buffer.from([0x00, 0x00, 0x01, 0x00, ...Array(100).fill(0)]);

            try {
                validateLogoImage(buffer, 'image/x-icon');
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });
    });

    describe('validateFaviconImage', () => {
        it('should enforce 512KB limit for favicons', () => {
            const buffer = Buffer.alloc(600 * 1024); // 600KB

            try {
                validateFaviconImage(buffer, 'image/x-icon');
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });

        it('should accept favicon formats', () => {
            const icoBuffer = Buffer.from([0x00, 0x00, 0x01, 0x00, ...Array(100).fill(0)]);
            expect(() => validateFaviconImage(icoBuffer, 'image/x-icon')).not.toThrow();

            const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(100).fill(0)]);
            expect(() => validateFaviconImage(pngBuffer, 'image/png')).not.toThrow();

            const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
            expect(() => validateFaviconImage(svgBuffer, 'image/svg+xml')).not.toThrow();
        });

        it('should reject JPEG format for favicons', () => {
            const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);

            try {
                validateFaviconImage(buffer, 'image/jpeg');
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            }
        });
    });
});

// Helper to create valid buffer for each content type
function createValidBuffer(contentType: string): Buffer {
    switch (contentType) {
        case 'image/jpeg':
            return Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);
        case 'image/png':
            return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(100).fill(0)]);
        case 'image/gif':
            return Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(100).fill(0)]);
        case 'image/webp':
            return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...Array(100).fill(0)]);
        case 'image/svg+xml':
            return Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
        case 'image/x-icon':
        case 'image/vnd.microsoft.icon':
            return Buffer.from([0x00, 0x00, 0x01, 0x00, ...Array(100).fill(0)]);
        default:
            return Buffer.from('invalid');
    }
}
