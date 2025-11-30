import { ErrorCode, ErrorDetail, Errors } from '../../errors';

export interface ImageValidationOptions {
    maxSizeBytes?: number;
    allowedTypes?: string[];
}

const DEFAULT_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const DEFAULT_ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/svg+xml',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
];

// Magic number signatures for common image formats
const MAGIC_NUMBERS = {
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    gif: [0x47, 0x49, 0x46], // "GIF"
    webp: [0x52, 0x49, 0x46, 0x46], // "RIFF" (WebP starts with RIFF...WEBP)
    ico: [0x00, 0x00, 0x01, 0x00], // ICO format
};

/**
 * Validates an uploaded image file.
 *
 * Performs the following checks:
 * 1. File size validation
 * 2. Content-Type header validation
 * 3. Magic number validation (file header bytes)
 *
 * @param buffer - Image file buffer
 * @param contentType - Content-Type header from request
 * @param options - Validation options (max size, allowed types)
 * @throws ApiError if validation fails
 */
export function validateImageUpload(
    buffer: Buffer,
    contentType: string | undefined,
    options: ImageValidationOptions = {},
): void {
    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
    const allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

    // 1. Size validation
    if (buffer.length === 0) {
        throw Errors.validationError('file', 'EMPTY_FILE');
    }

    if (buffer.length > maxSizeBytes) {
        throw Errors.validationError('file', 'IMAGE_TOO_LARGE');
    }

    // 2. Content-Type validation
    if (!contentType) {
        throw Errors.validationError('contentType', ErrorDetail.MISSING_FIELD);
    }

    const normalizedContentType = contentType.toLowerCase().split(';')[0].trim();

    if (!allowedTypes.includes(normalizedContentType)) {
        throw Errors.validationError('contentType', 'INVALID_IMAGE_TYPE');
    }

    // 3. Magic number validation (check file headers match content type)
    validateMagicNumber(buffer, normalizedContentType);
}

/**
 * Validates that the file's magic number (header bytes) matches the declared content type.
 *
 * @param buffer - Image file buffer
 * @param contentType - Normalized content type
 * @throws ApiError if magic number doesn't match
 */
function validateMagicNumber(buffer: Buffer, contentType: string): void {
    let isValid = false;

    // Check binary formats (JPEG, PNG, GIF, WebP, ICO)
    for (const [format, bytes] of Object.entries(MAGIC_NUMBERS)) {
        if (buffer.length < bytes.length) {
            continue;
        }

        const matches = bytes.every((byte, index) => buffer[index] === byte);

        if (matches) {
            // Verify the magic number matches the declared content type
            const expectedFormats = getExpectedFormatsForContentType(contentType);
            if (expectedFormats.includes(format)) {
                isValid = true;
                break;
            } else {
                throw Errors.validationError('file', 'CONTENT_TYPE_MISMATCH');
            }
        }
    }

    // Special handling for SVG (text-based, no binary magic number)
    if (!isValid && contentType === 'image/svg+xml') {
        const header = buffer.slice(0, 200).toString('utf-8');
        isValid = header.includes('<?xml') || header.includes('<svg') || header.trim().startsWith('<svg');

        if (!isValid) {
            throw Errors.validationError('file', 'INVALID_SVG');
        }
    }

    if (!isValid) {
        throw Errors.validationError('file', 'CORRUPTED_IMAGE');
    }
}

/**
 * Maps content type to expected magic number format identifiers.
 */
function getExpectedFormatsForContentType(contentType: string): string[] {
    const map: Record<string, string[]> = {
        'image/jpeg': ['jpeg'],
        'image/png': ['png'],
        'image/gif': ['gif'],
        'image/webp': ['webp'],
        'image/x-icon': ['ico'],
        'image/vnd.microsoft.icon': ['ico'],
        'image/svg+xml': ['svg'], // Handled separately
    };

    return map[contentType] || [];
}

/**
 * Validates a logo image (typically 2MB max, common formats).
 */
export function validateLogoImage(buffer: Buffer, contentType: string | undefined): void {
    validateImageUpload(buffer, contentType, {
        maxSizeBytes: 2 * 1024 * 1024, // 2MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
    });
}

/**
 * Validates a favicon image (typically 512KB max, favicon-specific formats).
 */
export function validateFaviconImage(buffer: Buffer, contentType: string | undefined): void {
    validateImageUpload(buffer, contentType, {
        maxSizeBytes: 512 * 1024, // 512KB
        allowedTypes: ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'],
    });
}
