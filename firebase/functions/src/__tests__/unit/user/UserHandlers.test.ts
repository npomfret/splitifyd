import {
    AuthUserRecordBuilder,
    PasswordChangeRequestBuilder,
    RegisteredUserBuilder,
    StubFirestoreDatabase,
    UserUpdateBuilder,
    createStubRequest,
    createStubResponse,
} from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { UserHandlers } from '../../../user/UserHandlers';
import { initializeI18n } from '../../../utils/i18n';
import { StubAuthService } from '../mocks/firestore-stubs';

describe('UserHandlers - Unit Tests', () => {
    let userHandlers: UserHandlers;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;

    beforeEach(async () => {
        // Initialize i18n for validation error messages
        await initializeI18n();

        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);

        userHandlers = new UserHandlers(applicationBuilder.buildUserService());
    });

    describe('updateUserProfile', () => {
        it('should update display name successfully', async () => {
            const userId = 'test-user-123';

            // Seed user in Firestore using builder
            // Note: uid and emailVerified are excluded - uid is the document ID, emailVerified is in Auth
            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Original Name')
                .withPhotoURL('https://example.com/photo.jpg')
                .withPreferredLanguage('en')
                .build();
            db.seedUser(userId, firestoreUser);

            // Seed user in Auth using builder
            const authUser = new AuthUserRecordBuilder()
                .withUid(userId)
                .withEmail('test@example.com')
                .withDisplayName('Original Name')
                .withPhotoURL('https://example.com/photo.jpg')
                .withEmailVerified(true)
                .build();
            stubAuth.setUser(userId, authUser);

            const updateRequest = new UserUpdateBuilder().withDisplayName('New Name').build();

            const req = createStubRequest(userId, updateRequest);
            const res = createStubResponse();

            await userHandlers.updateUserProfile(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                displayName: 'New Name',
            });
        });

        it('should update photoURL successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPhotoURL('https://example.com/old-photo.jpg')
                .build();
            db.seedUser(userId, firestoreUser);

            const authUser = new AuthUserRecordBuilder()
                .withUid(userId)
                .withEmail('test@example.com')
                .withDisplayName('Test User')
                .withPhotoURL('https://example.com/old-photo.jpg')
                .withEmailVerified(true)
                .build();
            stubAuth.setUser(userId, authUser);

            const updateRequest = new UserUpdateBuilder().withPhotoURL('https://example.com/new-photo.jpg').build();

            const req = createStubRequest(userId, updateRequest);
            const res = createStubResponse();

            await userHandlers.updateUserProfile(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json.displayName).toBe('Test User');
        });

        it('should update preferredLanguage successfully', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPreferredLanguage('en')
                .build();
            db.seedUser(userId, firestoreUser);

            const authUser = new AuthUserRecordBuilder()
                .withUid(userId)
                .withEmail('test@example.com')
                .withDisplayName('Test User')
                .withEmailVerified(true)
                .build();
            stubAuth.setUser(userId, authUser);

            const updateRequest = new UserUpdateBuilder().withPreferredLanguage('en').build();

            const req = createStubRequest(userId, updateRequest);
            const res = createStubResponse();

            await userHandlers.updateUserProfile(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
        });

        it('should update multiple fields at once', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Original Name')
                .withPhotoURL('https://example.com/old-photo.jpg')
                .withPreferredLanguage('en')
                .build();
            db.seedUser(userId, firestoreUser);

            const authUser = new AuthUserRecordBuilder()
                .withUid(userId)
                .withEmail('test@example.com')
                .withDisplayName('Original Name')
                .withPhotoURL('https://example.com/old-photo.jpg')
                .withEmailVerified(true)
                .build();
            stubAuth.setUser(userId, authUser);

            const updateRequest = new UserUpdateBuilder()
                .withDisplayName('New Name')
                .withPhotoURL('https://example.com/new-photo.jpg')
                .withPreferredLanguage('en')
                .build();

            const req = createStubRequest(userId, updateRequest);
            const res = createStubResponse();

            await userHandlers.updateUserProfile(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                displayName: 'New Name',
            });
        });

        it('should set photoURL to null (clear photo)', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .withPhotoURL('https://example.com/photo.jpg')
                .build();
            db.seedUser(userId, firestoreUser);

            const authUser = new AuthUserRecordBuilder()
                .withUid(userId)
                .withEmail('test@example.com')
                .withDisplayName('Test User')
                .withPhotoURL('https://example.com/photo.jpg')
                .withEmailVerified(true)
                .build();
            stubAuth.setUser(userId, authUser);

            const updateRequest = new UserUpdateBuilder().withPhotoURL(null).build();

            const req = createStubRequest(userId, updateRequest);
            const res = createStubResponse();

            await userHandlers.updateUserProfile(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
        });

        it('should reject update with no fields provided', async () => {
            const userId = 'test-user-123';
            const updateRequest = {};

            const req = createStubRequest(userId, updateRequest);
            req.language = 'en'; // Required for validation error messages
            const res = createStubResponse();

            await expect(userHandlers.updateUserProfile(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with invalid photoURL format', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder().withPhotoURL('not-a-valid-url').build();

            const req = createStubRequest(userId, updateRequest);
            req.language = 'en'; // Required for validation error messages
            const res = createStubResponse();

            await expect(userHandlers.updateUserProfile(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with displayName exceeding 100 characters', async () => {
            const userId = 'test-user-123';
            const longName = 'a'.repeat(101);
            const updateRequest = new UserUpdateBuilder().withDisplayName(longName).build();

            const req = createStubRequest(userId, updateRequest);
            req.language = 'en'; // Required for validation error messages
            const res = createStubResponse();

            await expect(userHandlers.updateUserProfile(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with empty display name', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder().withDisplayName('').build();

            const req = createStubRequest(userId, updateRequest);
            req.language = 'en'; // Required for validation error messages
            const res = createStubResponse();

            await expect(userHandlers.updateUserProfile(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with invalid language code', async () => {
            const userId = 'test-user-123';
            const updateRequest = new UserUpdateBuilder().withPreferredLanguage('invalid-lang').build();

            const req = createStubRequest(userId, updateRequest);
            req.language = 'en'; // Required for validation error messages
            const res = createStubResponse();

            await expect(userHandlers.updateUserProfile(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('changePassword', () => {
        it('should change password successfully with valid current password', async () => {
            const userId = 'test-user-123';

            const { uid, emailVerified, ...firestoreUser } = new RegisteredUserBuilder()
                .withUid(userId)
                .withDisplayName('Test User')
                .build();
            db.seedUser(userId, firestoreUser);

            const authUser = new AuthUserRecordBuilder()
                .withUid(userId)
                .withEmail('test@example.com')
                .withDisplayName('Test User')
                .withEmailVerified(true)
                .build();
            stubAuth.setUser(userId, authUser);

            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('NewValidPass456!')
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await userHandlers.changePassword(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            expect((res as any).getJson()).toMatchObject({
                message: 'Password changed successfully',
            });
        });

        it('should reject password change with weak new password (missing uppercase)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('validpass123!')
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await expect(userHandlers.changePassword(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (missing lowercase)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('VALIDPASS123!')
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await expect(userHandlers.changePassword(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (missing number)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('ValidPassword!')
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await expect(userHandlers.changePassword(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (missing special char)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('ValidPass123')
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await expect(userHandlers.changePassword(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change with weak new password (too short)', async () => {
            const userId = 'test-user-123';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword('ValidPass123!')
                .withNewPassword('Pass1!')
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await expect(userHandlers.changePassword(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject password change when new password equals current password', async () => {
            const userId = 'test-user-123';
            const samePassword = 'ValidPass123!';
            const passwordRequest = new PasswordChangeRequestBuilder()
                .withCurrentPassword(samePassword)
                .withNewPassword(samePassword)
                .build();

            const req = createStubRequest(userId, passwordRequest);
            const res = createStubResponse();

            await expect(userHandlers.changePassword(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create UserHandlers instance with default ApplicationBuilder', () => {
            const handlers = UserHandlers.createUserHandlers();
            expect(handlers).toBeInstanceOf(UserHandlers);
            expect(handlers.updateUserProfile).toBeDefined();
            expect(handlers.changePassword).toBeDefined();
        });
    });
});
