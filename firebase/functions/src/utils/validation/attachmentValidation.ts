import { ErrorDetail, Errors } from '../../errors';

interface AttachmentValidationOptions {
    maxSizeBytes: number;
    allowedTypes: string[];
}

// Magic number signatures for attachment formats
const MAGIC_NUMBERS = {
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    webp: [0x52, 0x49, 0x46, 0x46], // "RIFF" (WebP starts with RIFF...WEBP)
    pdf: [0x25, 0x50, 0x44, 0x46], // "%PDF"
    heic: [0x00, 0x00, 0x00], // HEIC/HEIF files have "ftyp" at byte 4, variable first 4 bytes (box size)
};

/**
 * Content types allowed for expense receipts.
 * Includes HEIC/HEIF for iPhone compatibility.
 */
const RECEIPT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Content types allowed for comment attachments.
 */
const COMMENT_ATTACHMENT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Validates an uploaded attachment file.
 *
 * Performs the following checks:
 * 1. File size validation
 * 2. Content-Type header validation
 * 3. Magic number validation (file header bytes)
 *
 * @param buffer - Attachment file buffer
 * @param contentType - Content-Type header from request
 * @param options - Validation options (max size, allowed types)
 * @throws ApiError if validation fails
 */
function validateAttachmentUpload(
    buffer: Buffer,
    contentType: string | undefined,
    options: AttachmentValidationOptions,
): void {
    // 1. Size validation
    if (buffer.length === 0) {
        throw Errors.validationError('file', 'EMPTY_FILE');
    }

    if (buffer.length > options.maxSizeBytes) {
        throw Errors.validationError('file', 'FILE_TOO_LARGE');
    }

    // 2. Content-Type validation
    if (!contentType) {
        throw Errors.validationError('contentType', ErrorDetail.MISSING_FIELD);
    }

    const normalizedContentType = contentType.toLowerCase().split(';')[0].trim();

    if (!options.allowedTypes.includes(normalizedContentType)) {
        throw Errors.validationError('contentType', 'INVALID_FILE_TYPE');
    }

    // 3. Magic number validation (check file headers match content type)
    validateMagicNumber(buffer, normalizedContentType);
}

/**
 * Checks if a buffer is a valid HEIC/HEIF file.
 * HEIC files use the ISO Base Media File Format (ISOBMFF):
 * - Bytes 0-3: Box size (variable)
 * - Bytes 4-7: "ftyp" (file type box marker)
 * - Bytes 8-11: Brand code (heic, mif1, heif, heix, msf1, etc.)
 */
function isHeicFile(buffer: Buffer): boolean {
    if (buffer.length < 12) {
        return false;
    }

    // Check for "ftyp" at bytes 4-7
    const ftypMarker = buffer.slice(4, 8).toString('ascii');
    if (ftypMarker !== 'ftyp') {
        return false;
    }

    // Check brand code at bytes 8-11 for HEIC/HEIF variants
    const brand = buffer.slice(8, 12).toString('ascii');
    const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heif'];
    return heicBrands.includes(brand);
}

/**
 * Validates that the file's magic number (header bytes) matches the declared content type.
 *
 * @param buffer - Attachment file buffer
 * @param contentType - Normalized content type
 * @throws ApiError if magic number doesn't match
 */
function validateMagicNumber(buffer: Buffer, contentType: string): void {
    const expectedFormats = getExpectedFormatsForContentType(contentType);

    if (expectedFormats.length === 0) {
        throw Errors.validationError('file', 'UNSUPPORTED_FORMAT');
    }

    // Special handling for HEIC/HEIF (uses ISOBMFF container, not simple magic bytes)
    if (expectedFormats.includes('heic')) {
        if (isHeicFile(buffer)) {
            return; // Valid HEIC/HEIF file
        }
        throw Errors.validationError('file', 'CORRUPTED_FILE');
    }

    let isValid = false;

    for (const [format, bytes] of Object.entries(MAGIC_NUMBERS)) {
        if (format === 'heic') {
            continue; // Handled above
        }

        if (buffer.length < bytes.length) {
            continue;
        }

        const matches = bytes.every((byte, index) => buffer[index] === byte);

        if (matches) {
            // For WebP, also verify the "WEBP" marker at offset 8
            if (format === 'webp') {
                if (buffer.length >= 12) {
                    const webpMarker = buffer.slice(8, 12).toString('ascii');
                    if (webpMarker !== 'WEBP') {
                        continue; // Not a WebP file
                    }
                } else {
                    continue;
                }
            }

            // Verify the magic number matches the declared content type
            if (expectedFormats.includes(format)) {
                isValid = true;
                break;
            } else {
                throw Errors.validationError('file', 'CONTENT_TYPE_MISMATCH');
            }
        }
    }

    if (!isValid) {
        throw Errors.validationError('file', 'CORRUPTED_FILE');
    }
}

/**
 * Maps content type to expected magic number format identifiers.
 */
function getExpectedFormatsForContentType(contentType: string): string[] {
    const map: Record<string, string[]> = {
        'image/jpeg': ['jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'image/heic': ['heic'],
        'image/heif': ['heic'], // HEIF uses same container format as HEIC
        'application/pdf': ['pdf'],
    };

    return map[contentType] || [];
}

/**
 * Validates an expense receipt upload.
 * - Max size: 10MB
 * - Allowed types: JPEG, PNG, WebP
 */
export function validateReceiptUpload(buffer: Buffer, contentType: string | undefined): void {
    validateAttachmentUpload(buffer, contentType, {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        allowedTypes: RECEIPT_ALLOWED_TYPES,
    });
}

/**
 * Validates a comment attachment upload.
 * - Max size: 5MB
 * - Allowed types: JPEG, PNG, WebP, PDF
 */
export function validateCommentAttachment(buffer: Buffer, contentType: string | undefined): void {
    validateAttachmentUpload(buffer, contentType, {
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
        allowedTypes: COMMENT_ATTACHMENT_ALLOWED_TYPES,
    });
}

/**
 * Get the file extension for a given content type.
 * Useful for generating file paths.
 */
export function getExtensionForContentType(contentType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'application/pdf': 'pdf',
    };

    return map[contentType.toLowerCase()] || 'bin';
}
