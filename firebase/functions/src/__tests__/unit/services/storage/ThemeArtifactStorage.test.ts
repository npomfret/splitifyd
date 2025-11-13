import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    LocalThemeArtifactStorage,
    computeSha256,
    createThemeArtifactStorage,
    type ThemeArtifactPayload,
} from '../../../../services/storage/ThemeArtifactStorage';
import * as firebase from '../../../../firebase';

vi.mock('fs/promises');
vi.mock('../../../../firebase');

describe('ThemeArtifactStorage', () => {
    describe('computeSha256', () => {
        it('should compute SHA-256 hash of content', () => {
            const content = 'test content';
            const hash = computeSha256(content);

            expect(hash).toBe('6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72');
            expect(hash).toHaveLength(64);
        });

        it('should produce different hashes for different content', () => {
            const hash1 = computeSha256('content1');
            const hash2 = computeSha256('content2');

            expect(hash1).not.toBe(hash2);
        });

        it('should produce same hash for same content', () => {
            const content = 'consistent content';
            const hash1 = computeSha256(content);
            const hash2 = computeSha256(content);

            expect(hash1).toBe(hash2);
        });

        it('should handle empty string', () => {
            const hash = computeSha256('');

            expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        });

        it('should handle unicode characters', () => {
            const content = '你好世界 🌍';
            const hash = computeSha256(content);

            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe('LocalThemeArtifactStorage', () => {
        let storage: LocalThemeArtifactStorage;
        let mockMkdir: ReturnType<typeof vi.fn>;
        let mockWriteFile: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            storage = new LocalThemeArtifactStorage();
            mockMkdir = vi.fn().mockResolvedValue(undefined);
            mockWriteFile = vi.fn().mockResolvedValue(undefined);

            vi.mocked(fs.mkdir).mockImplementation(mockMkdir);
            vi.mocked(fs.writeFile).mockImplementation(mockWriteFile);
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should save CSS and tokens to correct paths', async () => {
            const payload: ThemeArtifactPayload = {
                tenantId: 'test-tenant',
                hash: 'abc123',
                cssContent: ':root { --color: #fff; }',
                tokensJson: '{"version": 1}',
            };

            const result = await storage.save(payload);

            const expectedDir = path.join(process.cwd(), 'tmp', 'theme-artifacts', 'test-tenant', 'abc123');

            expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
            expect(mockWriteFile).toHaveBeenCalledTimes(2);

            expect(result.cssUrl).toBe(`file://${path.join(expectedDir, 'theme.css')}`);
            expect(result.tokensUrl).toBe(`file://${path.join(expectedDir, 'tokens.json')}`);
        });

        it('should write CSS content with UTF-8 encoding', async () => {
            const payload: ThemeArtifactPayload = {
                tenantId: 'test-tenant',
                hash: 'def456',
                cssContent: ':root { --primary: #ff0000; }',
                tokensJson: '{}',
            };

            await storage.save(payload);

            const cssPath = path.join(process.cwd(), 'tmp', 'theme-artifacts', 'test-tenant', 'def456', 'theme.css');

            expect(mockWriteFile).toHaveBeenCalledWith(cssPath, ':root { --primary: #ff0000; }', 'utf8');
        });

        it('should write tokens JSON with UTF-8 encoding', async () => {
            const payload: ThemeArtifactPayload = {
                tenantId: 'test-tenant',
                hash: 'ghi789',
                cssContent: '',
                tokensJson: '{"palette":{"primary":"#000"}}',
            };

            await storage.save(payload);

            const tokensPath = path.join(process.cwd(), 'tmp', 'theme-artifacts', 'test-tenant', 'ghi789', 'tokens.json');

            expect(mockWriteFile).toHaveBeenCalledWith(tokensPath, '{"palette":{"primary":"#000"}}', 'utf8');
        });

        it('should create nested directories for tenant and hash', async () => {
            const payload: ThemeArtifactPayload = {
                tenantId: 'nested-tenant-id',
                hash: 'nested-hash',
                cssContent: '',
                tokensJson: '{}',
            };

            await storage.save(payload);

            const expectedDir = path.join(process.cwd(), 'tmp', 'theme-artifacts', 'nested-tenant-id', 'nested-hash');

            expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
        });

        it('should write CSS and tokens in parallel', async () => {
            const payload: ThemeArtifactPayload = {
                tenantId: 'test-tenant',
                hash: 'parallel-hash',
                cssContent: 'css',
                tokensJson: 'json',
            };

            await storage.save(payload);

            // Both writeFile calls should have been made
            expect(mockWriteFile).toHaveBeenCalledTimes(2);
        });

        it('should propagate mkdir errors', async () => {
            const error = new Error('Directory creation failed');
            mockMkdir.mockRejectedValue(error);

            const payload: ThemeArtifactPayload = {
                tenantId: 'test-tenant',
                hash: 'error-hash',
                cssContent: '',
                tokensJson: '{}',
            };

            await expect(storage.save(payload)).rejects.toThrow('Directory creation failed');
        });

        it('should propagate writeFile errors', async () => {
            const error = new Error('Write failed');
            mockWriteFile.mockRejectedValue(error);

            const payload: ThemeArtifactPayload = {
                tenantId: 'test-tenant',
                hash: 'write-error',
                cssContent: '',
                tokensJson: '{}',
            };

            await expect(storage.save(payload)).rejects.toThrow('Write failed');
        });
    });

    describe('createThemeArtifactStorage', () => {
        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should return LocalThemeArtifactStorage when in emulator', () => {
            vi.mocked(firebase.isEmulator).mockReturnValue(true);

            const storage = createThemeArtifactStorage();

            expect(storage).toBeInstanceOf(LocalThemeArtifactStorage);
        });

        it('should return LocalThemeArtifactStorage when not in emulator', () => {
            vi.mocked(firebase.isEmulator).mockReturnValue(false);

            const storage = createThemeArtifactStorage();

            // Currently always returns LocalThemeArtifactStorage (placeholder for Cloud Storage)
            expect(storage).toBeInstanceOf(LocalThemeArtifactStorage);
        });
    });
});
