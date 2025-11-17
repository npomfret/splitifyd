import type { Email } from '@splitifyd/shared';
import { toDisplayName, toPassword } from '@splitifyd/shared';
import { getFirestore } from '../firebase';
import { createFirestoreDatabase, type IFirestoreDatabase } from '../firestore-wrapper';
import type { IAuthService } from '../services/auth';
import type { IFirestoreWriter } from '../services/firestore';
import { UserService } from '../services/UserService2';

interface PoolUser {
    token: string;
    email: Email;
    password: string;
}

interface FirestorePoolUser extends PoolUser {
    status: 'available' | 'borrowed';
    createdAt: FirebaseFirestore.Timestamp;
}

const POOL_PREFIX = 'testpool';
const POOL_DOMAIN = 'example.com';
const POOL_PASSWORD = 'passwordpass';
const POOL_COLLECTION = 'test-user-pool';

export class TestUserPoolService {
    private static instance: TestUserPoolService;
    private readonly db: IFirestoreDatabase = createFirestoreDatabase(getFirestore());

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
        const result = await this.firestoreWriter.runTransaction(async (transaction) => {
            // Query for available users directly within transaction
            // Since we deleted the deprecated getTestUsersByStatus method,
            // we implement this query directly using the Firestore instance
            const availableUsersQuery = this.db.collection(POOL_COLLECTION).where('status', '==', 'available').limit(1);
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
        });

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

        // Use FirestoreWriter for test pool user creation
        await this.firestoreWriter.createTestPoolUser(newUser.email, {
            email: newUser.email,
            token: newUser.token,
            password: newUser.password,
            status: 'borrowed' as const,
        });

        return newUser;
    }

    async returnUser(email: Email): Promise<void> {
        // Update user status using FirestoreWriter
        try {
            const result = await this.firestoreWriter.updateTestPoolUser(email, {
                status: 'available',
            });

            if (!result.success) {
                throw new Error(result.error || 'Update failed');
            }
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
            password: toPassword(POOL_PASSWORD),
            displayName: toDisplayName(`pool user ${id}`),
            termsAccepted: true,
            cookiePolicyAccepted: true,
            privacyPolicyAccepted: true,
        });

        const token = await this.authService.createCustomToken(user.uid);

        return { email, password: POOL_PASSWORD, token };
    }
}
