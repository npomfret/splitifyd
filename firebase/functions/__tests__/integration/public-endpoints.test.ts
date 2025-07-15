/**
 * @jest-environment node
 */

// Tests for public endpoints that don't require authentication

import { ApiDriver } from '../support/ApiDriver';

describe('Public Endpoints Tests', () => {
  let driver: ApiDriver;

  jest.setTimeout(15000);

  beforeAll(async () => {
    driver = new ApiDriver();
  });

  describe('Health Check Endpoint', () => {
    test('should return health status without authentication', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/health`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('checks');
      expect(data.checks).toHaveProperty('firestore');
      expect(data.checks).toHaveProperty('auth');
      expect(data.checks.firestore.status).toBe('healthy');
      expect(data.checks.auth.status).toBe('healthy');
      expect(typeof data.checks.firestore.responseTime).toBe('number');
      expect(typeof data.checks.auth.responseTime).toBe('number');
    });

    test('should include proper headers', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/health`);
      
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('x-content-type-options')).toBeDefined();
      expect(response.headers.get('x-frame-options')).toBeDefined();
    });

    test('should handle HEAD requests', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/health`, { method: 'HEAD' });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Status Endpoint', () => {
    test('should return system status without authentication', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/status`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('nodeVersion');
      expect(data).toHaveProperty('environment');
      
      // Validate memory structure
      expect(data.memory).toHaveProperty('rss');
      expect(data.memory).toHaveProperty('heapUsed');
      expect(data.memory).toHaveProperty('heapTotal');
      expect(data.memory).toHaveProperty('external');
      
      // Validate data types
      expect(typeof data.uptime).toBe('number');
      expect(typeof data.version).toBe('string');
      expect(typeof data.nodeVersion).toBe('string');
      expect(typeof data.environment).toBe('string');
    });

    test('should not expose sensitive information', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/status`);
      const data = await response.json();
      
      // Should not contain sensitive keys, tokens, or internal paths
      const jsonString = JSON.stringify(data);
      expect(jsonString).not.toMatch(/password|secret|key|token|api_key/i);
      expect(jsonString).not.toMatch(/\/home|\/usr|C:\\\\|firebase\/functions/i);
      expect(jsonString).not.toMatch(/process\.env/i);
    });
  });

  describe('Config Endpoint', () => {
    test('should return Firebase configuration without authentication', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/config`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('firebase');
      expect(data.firebase).toHaveProperty('apiKey');
      expect(data.firebase).toHaveProperty('authDomain');
      expect(data.firebase).toHaveProperty('projectId');
      
      // Should include emulator configuration in development
      if (data.environment === 'development') {
        expect(data).toHaveProperty('emulators');
        expect(data.emulators).toHaveProperty('auth');
        expect(data.emulators).toHaveProperty('firestore');
        expect(data.emulators).toHaveProperty('functions');
      }
    });

    test('should include proper cache headers', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/config`);
      
      expect(response.headers.get('cache-control')).toBeDefined();
      expect(response.headers.get('cache-control')).toMatch(/max-age=\d+/);
    });

    test('should not expose sensitive configuration', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/config`);
      const data = await response.json() as any;
      
      const jsonString = JSON.stringify(data);
      // Should not contain sensitive keys or internal configuration
      expect(jsonString).not.toMatch(/serviceAccount|privateKey|clientSecret/i);
      // Should not expose production secrets or keys
      expect(jsonString).not.toMatch(/secret.*key|admin.*key/i);
      
      // In development environments, formDefaults.password is allowed for testing convenience
      // but should not contain actual secrets (only test credentials)
      if (data.environment?.isDevelopment && data.formDefaults?.password) {
        // Allow test password in development, but ensure it's not a real secret
        expect(data.formDefaults.password).toMatch(/^[a-zA-Z0-9!@#$%^&*]+$/);
        expect(data.formDefaults.password.length).toBeLessThan(50); // Reasonable test password length
      }
    });
  });

  describe('CSP Violation Report Endpoint', () => {
    test('should accept CSP violation reports', async () => {
      const violationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'; script-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'https://evil.example.com/script.js',
          'status-code': 200,
          'script-sample': ''
        }
      };

      const response = await fetch(`${driver.getBaseUrl()}/csp-violation-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(violationReport)
      });

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    });

    test('should handle malformed CSP reports gracefully', async () => {
      const malformedReport = {
        'not-a-csp-report': 'invalid data'
      };

      const response = await fetch(`${driver.getBaseUrl()}/csp-violation-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(malformedReport)
      });

      // Should accept but log the issue
      expect(response.status).toBe(204);
    });

    test('should handle invalid JSON gracefully', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/csp-violation-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json'
      });

      expect([400, 500]).toContain(response.status); // Either is acceptable for invalid JSON
    });

    test('should reject non-POST methods', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        const response = await fetch(`${driver.getBaseUrl()}/csp-violation-report`, {
          method,
        });
        
        expect(response.status).toBe(404);
      }
    });
  });

  describe('CORS Headers', () => {
    test('should return proper CORS headers for OPTIONS requests', async () => {
      const testOrigin = 'http://localhost:3000';
      const response = await fetch(`${driver.getBaseUrl()}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': testOrigin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });

    test('should include CORS headers in actual requests', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/health`, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in all responses', async () => {
      const endpoints = ['/health', '/status', '/config'];
      
      for (const endpoint of endpoints) {
        const response = await fetch(`${driver.getBaseUrl()}${endpoint}`);
        
        expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
        expect(response.headers.get('X-Frame-Options')).toBeTruthy();
        expect(response.headers.get('X-XSS-Protection')).toBeTruthy();
        
        // Verify specific values
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      }
    });

  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/non-existent-endpoint`);
      
      expect(response.status).toBe(404);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
      expect(data.error.code).toBe('NOT_FOUND');
    });

    test('should handle invalid HTTP methods gracefully', async () => {
      const response = await fetch(`${driver.getBaseUrl()}/health`, {
        method: 'INVALID'
      });
      
      // Should either return 405 Method Not Allowed or 400 Bad Request
      expect([400, 405]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    test('should handle multiple requests to public endpoints', async () => {
      // Make multiple concurrent requests to test rate limiting
      const promises = Array.from({ length: 20 }, () => 
        fetch(`${driver.getBaseUrl()}/health`)
      );

      const responses = await Promise.all(promises);
      
      // Most should succeed, some might be rate limited
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitedCount).toBe(20);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
    });
  });
});