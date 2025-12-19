import { NextFunction, Request, Response } from 'express';
import { getAppConfig } from '../app-config';
import { Errors } from '../errors';
import { logger } from '../logger';
import { checkForDangerousPatterns } from '../utils/security';

/**
 * Routes that accept binary uploads (not JSON)
 * These paths are matched using a simple pattern where :param matches any segment
 */
const BINARY_UPLOAD_ROUTES = [
    '/admin/tenants/:tenantId/assets/:assetType',
    '/admin/tenants/:tenantId/images',
    '/groups/:groupId/attachments',
];

/**
 * Check if a request path matches a binary upload route pattern
 */
function isBinaryUploadRoute(path: string): boolean {
    return BINARY_UPLOAD_ROUTES.some(pattern => {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');

        if (patternParts.length !== pathParts.length) {
            return false;
        }

        return patternParts.every((part, i) => {
            return part.startsWith(':') || part === pathParts[i];
        });
    });
}

/**
 * Validate request size and structure depth
 */
export const validateRequestStructure = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.body) {
        return next();
    }

    // Skip validation for binary upload routes (raw buffers, not JSON)
    if (isBinaryUploadRoute(req.path)) {
        return next();
    }

    const config = getAppConfig();
    const { maxObjectDepth, maxPropertyCount, maxStringLength, maxPropertyNameLength } = config.validation;

    // Single recursive validation function
    const validateObject = (obj: unknown, depth = 0): void => {
        if (depth > maxObjectDepth) {
            throw Errors.invalidRequest('STRUCTURE_TOO_DEEP');
        }

        if (typeof obj === 'string') {
            if (obj.length > maxStringLength) {
                throw Errors.invalidRequest('STRING_TOO_LONG');
            }
            return;
        }

        if (Array.isArray(obj)) {
            if (obj.length > maxPropertyCount) {
                throw Errors.invalidRequest('ARRAY_TOO_LARGE');
            }
            obj.forEach((item) => validateObject(item, depth + 1));
            return;
        }

        if (obj && typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length > maxPropertyCount) {
                throw Errors.invalidRequest('TOO_MANY_PROPERTIES');
            }

            for (const key of keys) {
                if (key.length > maxPropertyNameLength) {
                    throw Errors.invalidRequest('PROPERTY_NAME_TOO_LONG');
                }
                const value = (obj as Record<string, unknown>)[key];
                validateObject(value, depth + 1);
            }
        }
    };

    validateObject(req.body);

    // JSON.stringify handles circular references naturally by throwing an error
    let requestString: string;
    try {
        requestString = JSON.stringify(req.body);
    } catch {
        throw Errors.invalidRequest('CIRCULAR_REFERENCE');
    }

    const dangerCheck = checkForDangerousPatterns(requestString);
    if (dangerCheck.isDangerous) {
        logger.warn('request-blocked-dangerous-pattern', {
            matchedPattern: dangerCheck.matchedPattern,
            path: req.path,
            method: req.method,
        });
        throw Errors.invalidRequest('DANGEROUS_CONTENT');
    }

    next();
};

/**
 * Validate content type for JSON endpoints
 */
export const validateContentType = (req: Request, _res: Response, next: NextFunction): void => {
    // Skip for GET requests, DELETE requests without body, and OPTIONS (CORS preflight)
    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'DELETE') {
        return next();
    }

    // Skip for binary upload routes
    if (isBinaryUploadRoute(req.path)) {
        return next();
    }

    const contentType = req.headers['content-type'];

    // If no content-type but also no content-length, allow it (empty body)
    const contentLength = req.headers['content-length'];
    if ((!contentType || contentType === '') && (!contentLength || contentLength === '0')) {
        return next();
    }

    if (!contentType || !contentType.includes('application/json')) {
        throw Errors.invalidRequest('INVALID_CONTENT_TYPE');
    }

    next();
};
