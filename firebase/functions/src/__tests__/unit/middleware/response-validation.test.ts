import { responseSchemas } from '@billsplit-wl/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Normalize an Express path to match the responseSchemas keys
 * (Copied from middleware.ts for testing)
 */
function normalizePath(path: string): string {
    let normalized = path.replace(/^\/api/, '');

    // Use $ anchors where appropriate to prevent over-matching
    // IMPORTANT: Static paths like /groups/share, /groups/join, /groups/preview must NOT be normalized
    normalized = normalized
        // Group-related parameters (most specific first)
        .replace(/\/groups\/[^/:]+\/members\/[^/:]+$/, '/groups/:groupId/members/:memberId')
        .replace(/\/groups\/[^/:]+\/comments$/, '/groups/:groupId/comments')
        .replace(/\/groups\/[^/:]+\/full-details$/, '/groups/:groupId/full-details')
        .replace(/\/groups\/[^/:]+\/members\/display-name$/, '/groups/:groupId/members/display-name')
        .replace(/\/groups\/[^/:]+\/members\/pending$/, '/groups/:groupId/members/pending')
        .replace(/\/groups\/[^/:]+\/members$/, '/groups/:groupId/members')
        .replace(/\/groups\/[^/:]+\/leave$/, '/groups/:groupId/leave')
        .replace(/\/groups\/[^/:]+\/archive$/, '/groups/:groupId/archive')
        .replace(/\/groups\/[^/:]+\/unarchive$/, '/groups/:groupId/unarchive')
        .replace(/\/groups\/[^/:]+\/security\/permissions$/, '/groups/:groupId/security/permissions')
        // Only normalize /groups/:groupId if it's NOT a static endpoint (share, join, preview, balances)
        .replace(/\/groups\/(?!share$|join$|preview$|balances$)[^/:]+$/, '/groups/:groupId')
        // Expense-related parameters
        .replace(/\/expenses\/[^/:]+\/comments$/, '/expenses/:expenseId/comments')
        .replace(/\/expenses\/[^/:]+\/full-details$/, '/expenses/:expenseId/full-details')
        .replace(/\/expenses\/[^/:]+$/, '/expenses/:expenseId')
        // Settlement-related parameters
        .replace(/\/settlements\/[^/:]+$/, '/settlements/:settlementId')
        // Merge-related parameters
        .replace(/\/merge\/[^/:]+$/, '/merge/:jobId')
        // Policy-related parameters
        .replace(/\/policies\/[^/:]+\/current$/, '/policies/:policyId/current')
        .replace(/\/admin\/policies\/[^/:]+\/publish$/, '/admin/policies/:policyId/publish')
        .replace(/\/admin\/policies\/[^/:]+$/, '/admin/policies/:policyId')
        // Admin user parameters
        .replace(/\/admin\/users\/[^/:]+\/role$/, '/admin/users/:userId/role')
        .replace(/\/admin\/users\/[^/:]+$/, '/admin/users/:userId')
        // Admin tenant asset parameters
        .replace(/\/admin\/tenants\/[^/:]+\/assets\/[^/:]+$/, '/admin/tenants/:tenantId/assets/:assetType');

    return normalized;
}

function getResponseSchema(method: string, path: string): z.ZodSchema | undefined {
    const normalizedPath = normalizePath(path);

    const methodKey = `${method} ${normalizedPath}` as keyof typeof responseSchemas;
    if (methodKey in responseSchemas) {
        return responseSchemas[methodKey] as z.ZodSchema;
    }

    const pathKey = normalizedPath as keyof typeof responseSchemas;
    if (pathKey in responseSchemas) {
        return responseSchemas[pathKey] as z.ZodSchema;
    }

    return undefined;
}

describe('Response Validation', () => {
    describe('normalizePath', () => {
        it('removes /api prefix', () => {
            expect(normalizePath('/api/groups')).toBe('/groups');
        });

        it('normalizes group ID parameters', () => {
            expect(normalizePath('/groups/abc123')).toBe('/groups/:groupId');
            expect(normalizePath('/groups/abc123/members')).toBe('/groups/:groupId/members');
            expect(normalizePath('/groups/abc123/full-details')).toBe('/groups/:groupId/full-details');
        });

        it('normalizes group member parameters', () => {
            expect(normalizePath('/groups/abc123/members/user456')).toBe('/groups/:groupId/members/:memberId');
        });

        it('normalizes group comments parameters', () => {
            expect(normalizePath('/groups/abc123/comments')).toBe('/groups/:groupId/comments');
        });

        it('normalizes expense parameters', () => {
            expect(normalizePath('/expenses/exp123')).toBe('/expenses/:expenseId');
            expect(normalizePath('/expenses/exp123/full-details')).toBe('/expenses/:expenseId/full-details');
            expect(normalizePath('/expenses/exp123/comments')).toBe('/expenses/:expenseId/comments');
        });

        it('normalizes settlement parameters', () => {
            expect(normalizePath('/settlements/set123')).toBe('/settlements/:settlementId');
        });

        it('normalizes merge parameters', () => {
            expect(normalizePath('/merge/job123')).toBe('/merge/:jobId');
        });

        it('normalizes admin policy parameters', () => {
            expect(normalizePath('/admin/policies/pol123')).toBe('/admin/policies/:policyId');
            expect(normalizePath('/admin/policies/pol123/publish')).toBe('/admin/policies/:policyId/publish');
        });

        it('normalizes admin user parameters', () => {
            expect(normalizePath('/admin/users/user123')).toBe('/admin/users/:userId');
            expect(normalizePath('/admin/users/user123/role')).toBe('/admin/users/:userId/role');
        });

        it('does NOT normalize static group endpoints', () => {
            // These are static endpoints, not ID parameters
            expect(normalizePath('/groups/share')).toBe('/groups/share');
            expect(normalizePath('/groups/join')).toBe('/groups/join');
            expect(normalizePath('/groups/preview')).toBe('/groups/preview');
            expect(normalizePath('/groups/balances')).toBe('/groups/balances');
        });
    });

    describe('getResponseSchema', () => {
        it('returns schema for method-specific endpoint', () => {
            const schema = getResponseSchema('GET', '/groups');
            expect(schema).toBeDefined();
        });

        it('returns schema for path-only endpoint', () => {
            const schema = getResponseSchema('GET', '/config');
            expect(schema).toBeDefined();
        });

        it('returns undefined for unknown endpoint', () => {
            const schema = getResponseSchema('GET', '/unknown-endpoint');
            expect(schema).toBeUndefined();
        });

        it('matches normalized paths with parameters', () => {
            const schema = getResponseSchema('GET', '/groups/abc123/full-details');
            expect(schema).toBeDefined();
        });
    });

    describe('schema validation', () => {
        it('validates valid group response', () => {
            const schema = getResponseSchema('POST', '/groups');
            expect(schema).toBeDefined();

            const validResponse = {
                id: 'group-123',
                name: 'Test Group',
                lastActivity: '2025-01-15T10:00:00.000Z',
            };

            const result = schema!.safeParse(validResponse);
            expect(result.success).toBe(true);
        });

        it('rejects invalid group response (missing required field)', () => {
            const schema = getResponseSchema('POST', '/groups');
            expect(schema).toBeDefined();

            const invalidResponse = {
                id: 'group-123',
                // missing name field
                lastActivity: '2025-01-15T10:00:00.000Z',
            };

            const result = schema!.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });

        it('validates void response for DELETE operations', () => {
            const schema = getResponseSchema('DELETE', '/expenses/expense-123');
            expect(schema).toBeDefined();

            // DELETE operations return 204 No Content (void)
            const result = schema!.safeParse(undefined);
            expect(result.success).toBe(true);
        });

        it('validates register response', () => {
            const schema = getResponseSchema('POST', '/register');
            expect(schema).toBeDefined();

            const validResponse = {
                success: true,
                message: 'User registered successfully',
                user: {
                    uid: 'user-123',
                    displayName: 'Test User',
                },
            };

            const result = schema!.safeParse(validResponse);
            expect(result.success).toBe(true);
        });
    });
});
