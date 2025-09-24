import type { IFirestoreReader, IFirestoreWriter } from '../services/firestore';
import { UserService } from '../services/UserService2';
import type { IAuthService } from '../services/auth';

export interface PoolUser {
    token: string;
    email: string;
    password: string;
}

interface FirestorePoolUser extends PoolUser {
    status: 'available' | 'borrowed';
    createdAt: FirebaseFirestore.Timestamp;
}

const POOL_PREFIX = 'testpool';
const POOL_DOMAIN = 'example.com';
const POOL_PASSWORD = 'rrRR44$$';
const POOL_COLLECTION = 'test-user-pool';

export class TestUserPoolService {
    private static instance: TestUserPoolService;

    private constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly userService: UserService,
        private readonly authService: IAuthService,
    ) {}

    static getInstance(firestoreReader: IFirestoreReader, firestoreWriter: IFirestoreWriter, userService: UserService, authService: IAuthService): TestUserPoolService {
        if (!TestUserPoolService.instance) {
            TestUserPoolService.instance = new TestUserPoolService(firestoreReader, firestoreWriter, userService, authService);
        }
        return TestUserPoolService.instance;
    }

    async borrowUser(): Promise<PoolUser> {
        // Use transaction to atomically claim an available user
        const result = await this.firestoreWriter.runTransaction(
            async (transaction) => {
                // Query for available users using FirestoreReader
                const availableUsers = await this.firestoreReader.getTestUsersByStatus('available', 1);

                if (availableUsers.length > 0) {
                    // Found an available user - claim it atomically
                    const doc = availableUsers[0];
                    const data = doc.data() as FirestorePoolUser;

                    // Update status to borrowed within transaction
                    this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, { status: 'borrowed' });

                    return {
                        email: data.email,
                        token: data.token,
                        password: data.password,
                    };
                }

                // No available users - return null to create new one outside transaction
                return null;
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'borrowTestUser',
                    poolCollection: POOL_COLLECTION,
                },
            },
        );

        if (result) {
            return {
                // todo: this should problably be a PooledTestUser
                email: result.email!,
                token: result.token!,
                password: result.password!,
            };
        }

        // No available users found - create a new one
        // This is done outside transaction since createUser() involves Auth API calls
        const newUser = await this.createUser();
        await this.firestoreWriter.createTestUser(newUser.email, {
            email: newUser.email,
            token: newUser.token,
            password: newUser.password,
            status: 'borrowed' as const,
        });
        return newUser;
    }

    async returnUser(email: string): Promise<void> {
        // Update user status directly using the encapsulated method
        // This is simpler and doesn't require transaction complexity for a status update
        try {
            await this.firestoreWriter.updateTestUserStatus(email, 'available');
        } catch (error) {
            // If user doesn't exist or update fails, wrap with more context
            throw new Error(`Failed to return user ${email} to pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async createUser(): Promise<PoolUser> {
        // unique enough!
        const id = Math.random().toString(16).substring(2, 10); // e.g., "a1b2c3d4"

        const email = `${POOL_PREFIX}.${id}@${POOL_DOMAIN}`;

        const user = await this.userService.createUserDirect({
            email,
            password: POOL_PASSWORD,
            displayName: `pool user ${id}`,
            termsAccepted: true,
            cookiePolicyAccepted: true,
        });

        const token = await this.authService.createCustomToken(user.uid);

        return { email, password: POOL_PASSWORD, token };
    }
}
