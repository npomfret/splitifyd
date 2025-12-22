import type { Request } from 'express';
import { ErrorDetail, Errors } from '../errors';

/**
 * Result of validating and resolving request host information.
 */
interface ValidatedHostInfo {
    /**
     * Normalized host without port (used for validation and tenant lookup).
     */
    host: string;
    /**
     * Public host as supplied by proxy/host headers (includes port when present).
     */
    publicHost: string;
}

/**
 * Resolves and validates request host information from HTTP headers.
 * Handles Host, X-Forwarded-Host, Origin, and Referer headers to determine
 * the canonical host and validate consistency across headers.
 *
 * Used by handlers that need tenant context resolution (e.g., password reset,
 * email verification, email change).
 */
export class HostResolver {
    /**
     * Resolve request host from headers and validate consistency.
     * @param req - Express request object
     * @returns Validated host information
     * @throws ApiError with HOST_MISMATCH if headers are inconsistent
     * @throws ApiError with HOST_MISSING if no host can be determined
     */
    resolve(req: Request): ValidatedHostInfo {
        const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined;
        const forwardedHostHeader = Array.isArray(req.headers['x-forwarded-host'])
            ? req.headers['x-forwarded-host'].join(',')
            : (req.headers['x-forwarded-host'] as string | undefined);

        const normalizedHostHeader = this.normalizeHostHeaderValue(hostHeader);
        const normalizedForwardedHostHeader = this.normalizeHostHeaderValue(forwardedHostHeader);

        if (normalizedForwardedHostHeader && normalizedHostHeader && normalizedForwardedHostHeader !== normalizedHostHeader) {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
        }

        const candidateHost = normalizedForwardedHostHeader
            ?? normalizedHostHeader
            ?? (typeof req.hostname === 'string' ? req.hostname.trim().toLowerCase() : null)
            ?? null;

        if (!candidateHost) {
            throw Errors.invalidRequest(ErrorDetail.HOST_MISSING);
        }

        const publicHost = this.resolvePublicHost(forwardedHostHeader)
            ?? this.resolvePublicHost(hostHeader)
            ?? candidateHost;

        const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
        if (typeof originHeader === 'string') {
            const normalizedOriginHost = this.normalizeUrlHost(originHeader);
            if (normalizedOriginHost && normalizedOriginHost !== candidateHost) {
                throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
            }
        }

        const refererHeader = Array.isArray(req.headers.referer)
            ? req.headers.referer[0]
            : (req.headers.referer as string | undefined);
        if (typeof refererHeader === 'string') {
            const normalizedRefererHost = this.normalizeUrlHost(refererHeader);
            if (normalizedRefererHost && normalizedRefererHost !== candidateHost) {
                throw Errors.invalidRequest(ErrorDetail.HOST_MISMATCH);
            }
        }

        return { host: candidateHost, publicHost };
    }

    private normalizeHostHeaderValue(hostHeaderValue: string | undefined): string | null {
        if (!hostHeaderValue) {
            return null;
        }

        const raw = hostHeaderValue.trim().toLowerCase();
        if (!raw) {
            return null;
        }

        const [first] = raw.split(',');
        const withoutPort = first.trim().replace(/:\d+$/, '');
        return withoutPort || null;
    }

    private resolvePublicHost(hostHeaderValue: string | undefined): string | null {
        if (!hostHeaderValue) {
            return null;
        }

        const raw = hostHeaderValue.trim();
        if (!raw) {
            return null;
        }

        const [first] = raw.split(',');
        return first.trim() || null;
    }

    private normalizeUrlHost(urlValue: string): string | null {
        try {
            const parsed = new URL(urlValue);
            const host = parsed.host.trim().toLowerCase();
            const withoutPort = host.replace(/:\d+$/, '');
            return withoutPort || null;
        } catch {
            return null;
        }
    }
}
