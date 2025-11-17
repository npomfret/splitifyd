import { RegisteredUserBuilder, TenantFirestoreTestDatabase } from '@splitifyd/test-support';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserBrowserHandlers } from '../../../browser/UserBrowserHandlers';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

describe('UserBrowserHandlers - Unit Tests', () => {
    let handlers: UserBrowserHandlers;
    let db: TenantFirestoreTestDatabase;
    let authService: StubAuthService;
    let componentBuilder: ComponentBuilder;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let jsonSpy: ReturnType<typeof vi.fn>;
    let statusSpy: ReturnType<typeof vi.fn>;

    // Helper to convert RegisteredUser to format compatible with setUser
    function toUserRecord(user: any) {
        return {
            ...user,
            photoURL: user.photoURL === null ? undefined : user.photoURL,
        };
    }

    beforeEach(() => {
        db = new TenantFirestoreTestDatabase();
        authService = new StubAuthService();
        componentBuilder = new ComponentBuilder(authService, db);
        handlers = new UserBrowserHandlers(authService, db);

        // Setup mock request and response
        jsonSpy = vi.fn();
        statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });

        mockReq = {
            query: {},
        };

        mockRes = {
            json: jsonSpy,
            status: statusSpy,
        };
    });

    describe('Static Factory Method', () => {
        it('should create UserBrowserHandlers instance with ComponentBuilder', () => {
            expect(handlers).toBeInstanceOf(UserBrowserHandlers);
            expect(handlers.listAuthUsers).toBeDefined();
            expect(handlers.listFirestoreUsers).toBeDefined();
        });
    });

    describe('listAuthUsers', () => {
        it('should list all auth users with default pagination', async () => {
            // Setup: Add users to auth service
            const user1 = new RegisteredUserBuilder().withUid('user1').withEmail('user1@test.com').build();
            const user2 = new RegisteredUserBuilder().withUid('user2').withEmail('user2@test.com').build();

            authService.setUser(user1.uid, toUserRecord(user1));
            authService.setUser(user2.uid, toUserRecord(user2));

            // Execute
            await handlers.listAuthUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: expect.arrayContaining([
                        expect.objectContaining({ uid: 'user1', email: 'user1@test.com' }),
                        expect.objectContaining({ uid: 'user2', email: 'user2@test.com' }),
                    ]),
                    hasMore: false,
                }),
            );
        });

        it('should filter by email when email query param is provided', async () => {
            // Setup
            const user1 = new RegisteredUserBuilder().withUid('user1').withEmail('user1@test.com').build();
            const user2 = new RegisteredUserBuilder().withUid('user2').withEmail('user2@test.com').build();

            authService.setUser(user1.uid, toUserRecord(user1));
            authService.setUser(user2.uid, toUserRecord(user2));

            mockReq.query = { email: 'user1@test.com' };

            // Execute
            await handlers.listAuthUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: [expect.objectContaining({ uid: 'user1', email: 'user1@test.com' })],
                    hasMore: false,
                }),
            );
        });

        it('should filter by uid when uid query param is provided', async () => {
            // Setup
            const user1 = new RegisteredUserBuilder().withUid('user1').withEmail('user1@test.com').build();
            const user2 = new RegisteredUserBuilder().withUid('user2').withEmail('user2@test.com').build();

            authService.setUser(user1.uid, toUserRecord(user1));
            authService.setUser(user2.uid, toUserRecord(user2));

            mockReq.query = { uid: 'user1' };

            // Execute
            await handlers.listAuthUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: [expect.objectContaining({ uid: 'user1' })],
                    hasMore: false,
                }),
            );
        });

        it('should return empty array when user not found by email', async () => {
            mockReq.query = { email: 'nonexistent@test.com' };

            await handlers.listAuthUsers(mockReq as Request, mockRes as Response);

            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: [],
                    hasMore: false,
                }),
            );
        });

        it('should respect limit parameter', async () => {
            // Setup: Add multiple users
            for (let i = 0; i < 10; i++) {
                const user = new RegisteredUserBuilder()
                    .withUid(`user${i}`)
                    .withEmail(`user${i}@test.com`)
                    .build();
                authService.setUser(user.uid, toUserRecord(user));
            }

            mockReq.query = { limit: '5' };

            // Execute
            await handlers.listAuthUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: expect.arrayContaining([
                        expect.any(Object),
                    ]),
                }),
            );

            const callArgs = jsonSpy.mock.calls[0][0];
            expect(callArgs.users.length).toBeLessThanOrEqual(5);
        });
    });

    describe('listFirestoreUsers', () => {
        it('should list all firestore users with default pagination', async () => {
            // Setup: Add users to firestore
            const user1 = new RegisteredUserBuilder().withUid('user1').withEmail('user1@test.com').withDisplayName('User One').build();
            const user2 = new RegisteredUserBuilder().withUid('user2').withEmail('user2@test.com').withDisplayName('User Two').build();

            const { uid: uid1, emailVerified: ev1, photoURL: pu1, ...firestoreUser1 } = user1;
            const { uid: uid2, emailVerified: ev2, photoURL: pu2, ...firestoreUser2 } = user2;

            db.seedUser(uid1, firestoreUser1);
            db.seedUser(uid2, firestoreUser2);

            // Execute
            await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: expect.arrayContaining([
                        expect.objectContaining({ id: 'user1', email: 'user1@test.com' }),
                        expect.objectContaining({ id: 'user2', email: 'user2@test.com' }),
                    ]),
                    hasMore: false,
                }),
            );
        });

        it('should filter by uid when uid query param is provided', async () => {
            // Setup
            const user1 = new RegisteredUserBuilder().withUid('user1').withEmail('user1@test.com').build();
            const user2 = new RegisteredUserBuilder().withUid('user2').withEmail('user2@test.com').build();

            const { uid: uid1, emailVerified: ev1, photoURL: pu1, ...firestoreUser1 } = user1;
            const { uid: uid2, emailVerified: ev2, photoURL: pu2, ...firestoreUser2 } = user2;

            db.seedUser(uid1, firestoreUser1);
            db.seedUser(uid2, firestoreUser2);

            mockReq.query = { uid: 'user1' };

            // Execute
            await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: [expect.objectContaining({ id: 'user1', email: 'user1@test.com' })],
                    hasMore: false,
                }),
            );
        });

        it('should return empty array when uid not found', async () => {
            mockReq.query = { uid: 'nonexistent' };

            await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: [],
                    hasMore: false,
                }),
            );
        });

        it('should filter by email when email query param is provided', async () => {
            // Setup
            const user1 = new RegisteredUserBuilder().withUid('user1').withEmail('user1@test.com').build();
            const user2 = new RegisteredUserBuilder().withUid('user2').withEmail('user2@test.com').build();

            const { uid: uid1, emailVerified: ev1, photoURL: pu1, ...firestoreUser1 } = user1;
            const { uid: uid2, emailVerified: ev2, photoURL: pu2, ...firestoreUser2 } = user2;

            db.seedUser(uid1, firestoreUser1);
            db.seedUser(uid2, firestoreUser2);

            mockReq.query = { email: 'user1@test.com' };

            // Execute
            await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

            // Verify
            expect(jsonSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    users: expect.arrayContaining([
                        expect.objectContaining({ id: 'user1', email: 'user1@test.com' }),
                    ]),
                    hasMore: false,
                }),
            );
        });

        it('should handle pagination with cursor', async () => {
            // Setup: Add multiple users
            for (let i = 0; i < 5; i++) {
                const user = new RegisteredUserBuilder()
                    .withUid(`user${i}`)
                    .withEmail(`user${i}@test.com`)
                    .build();
                const { uid, emailVerified, photoURL, ...firestoreUser } = user;
                db.seedUser(uid, firestoreUser);
            }

            // First request with limit
            mockReq.query = { limit: '2' };
            await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

            const firstCallArgs = jsonSpy.mock.calls[0][0];
            expect(firstCallArgs.users.length).toBeLessThanOrEqual(2);

            // If there's a cursor, test pagination
            if (firstCallArgs.nextCursor) {
                jsonSpy.mockClear();
                mockReq.query = { limit: '2', cursor: firstCallArgs.nextCursor };
                await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

                const secondCallArgs = jsonSpy.mock.calls[0][0];
                expect(secondCallArgs.users.length).toBeGreaterThan(0);
            }
        });

        it('should respect limit parameter', async () => {
            // Setup: Add multiple users
            for (let i = 0; i < 10; i++) {
                const user = new RegisteredUserBuilder()
                    .withUid(`user${i}`)
                    .withEmail(`user${i}@test.com`)
                    .build();
                const { uid, emailVerified, photoURL, ...firestoreUser } = user;
                db.seedUser(uid, firestoreUser);
            }

            mockReq.query = { limit: '5' };

            // Execute
            await handlers.listFirestoreUsers(mockReq as Request, mockRes as Response);

            // Verify
            const callArgs = jsonSpy.mock.calls[0][0];
            expect(callArgs.users.length).toBeLessThanOrEqual(5);
        });
    });
});
