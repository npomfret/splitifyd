import type { IFirestoreWriter } from '../services/firestore';
import { UserService } from '../services/UserService2';
import type { IAuthService } from '../services/auth';
import { getFirestore } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';

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
    private readonly db = getFirestore();

    constructor(
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly userService: UserService,
        private readonly authService: IAuthService,
    ) {}

    static getInstance(firestoreWriter: IFirestoreWriter, userService: UserService, authService: IAuthService): TestUserPoolService {
        if (!TestUserPoolService.instance) {
            TestUserPoolService.instance = new TestUserPoolService(firestoreWriter, userService, authService);
        }
        return TestUserPoolService.instance;
    }

    async borrowUser(): Promise<PoolUser> {
        // Use transaction to atomically claim an available user
        const result = await this.firestoreWriter.runTransaction(
            async (transaction) => {
                // Query for available users directly within transaction
                // Since we deleted the deprecated getTestUsersByStatus method,
                // we implement this query directly using the Firestore instance
                const availableUsersQuery = this.db.collection(POOL_COLLECTION)
                    .where('status', '==', 'available')
                    .limit(1);
                const availableUsersSnapshot = await transaction.get(availableUsersQuery);

                if (!availableUsersSnapshot.empty) {
                    // Found an available user - claim it atomically
                    const doc = availableUsersSnapshot.docs[0];
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

        // Use direct Firestore operation instead of deprecated createTestUser method
        await this.db.collection(POOL_COLLECTION).doc(newUser.email).set({
            email: newUser.email,
            token: newUser.token,
            password: newUser.password,
            status: 'borrowed' as const,
            createdAt: FieldValue.serverTimestamp(),
        });

        return newUser;
    }

    async returnUser(email: string): Promise<void> {
        // Update user status directly using direct Firestore operation
        // This is simpler and doesn't require transaction complexity for a status update
        try {
            await this.db.collection(POOL_COLLECTION).doc(email).update({
                status: 'available',
            });
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
