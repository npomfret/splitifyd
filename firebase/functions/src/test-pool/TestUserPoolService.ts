import {admin, firestoreDb} from '../firebase';
import {getUserService} from '../services/serviceRegistration';
import {RegisteredUser} from "@splitifyd/shared";
import {runTransactionWithRetry} from '../utils/firestore-helpers';

export interface PoolUser {
    user: RegisteredUser,
    token: string
    password: string
}

interface FirestorePoolUser extends  PoolUser {
    status: 'available' | 'borrowed';
    createdAt: FirebaseFirestore.Timestamp;
}

const POOL_PREFIX = 'testpool';
const POOL_DOMAIN = 'example.com';
const POOL_PASSWORD = 'rrRR44$$';
const POOL_COLLECTION = 'test-user-pool';

export class TestUserPoolService {
    private static instance: TestUserPoolService;

    private constructor() {
    }

    static getInstance(): TestUserPoolService {
        if (!TestUserPoolService.instance) {
            TestUserPoolService.instance = new TestUserPoolService();
        }
        return TestUserPoolService.instance;
    }

    async borrowUser(): Promise<PoolUser> {
        const poolRef = firestoreDb.collection(POOL_COLLECTION);
        
        // Use transaction to atomically claim an available user
        const result = await runTransactionWithRetry(
            async (transaction) => {
                // Query for available users
                const availableQuery = await transaction.get(
                    poolRef.where('status', '==', 'available').limit(1)
                );
                
                if (!availableQuery.empty) {
                    // Found an available user - claim it atomically
                    const doc = availableQuery.docs[0];
                    const data = doc.data() as FirestorePoolUser;
                    
                    // Update status to borrowed within transaction
                    transaction.update(doc.ref, { status: 'borrowed' });
                    
                    return {
                        user: data.user,
                        token: data.token,
                        password: data.password
                    };
                }
                
                // No available users - return null to create new one outside transaction
                return null;
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'borrowTestUser',
                    poolCollection: POOL_COLLECTION
                }
            }
        );
        
        if (result) {
            return result;
        }
        
        // No available users found - create a new one
        // This is done outside transaction since createUser() involves Auth API calls
        const newUser = await this.createUser();
        await poolRef.doc(newUser.user.email).set({
            email: newUser.user.email,
            user: newUser.user,
            token: newUser.token,
            password: newUser.password,
            status: 'borrowed' as const,
            createdAt: admin.firestore.Timestamp.now()
        });
        return newUser;
    }

    async returnUser(email: string): Promise<void> {
        const poolRef = firestoreDb.collection(POOL_COLLECTION);
        
        // Use transaction to atomically return user
        await runTransactionWithRetry(
            async (transaction) => {
                const doc = await transaction.get(poolRef.doc(email));
                
                if (!doc.exists) {
                    throw Error(`User ${email} not found in pool`);
                }
                
                const data = doc.data() as FirestorePoolUser;
                if (data.status !== 'borrowed') {
                    // This could be a duplicate return attempt - make it idempotent
                    if (data.status === 'available') {
                        // User is already available - this is fine, just log it
                        console.log(`⚠️ User ${email} was already returned to pool`);
                        return;
                    }
                    throw Error(`User ${email} is not borrowed (status: ${data.status})`);
                }
                
                // Update status to available within transaction
                transaction.update(doc.ref, { status: 'available' });
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'returnTestUser',
                    email,
                    poolCollection: POOL_COLLECTION
                }
            }
        );
    }

    private async createUser(): Promise<PoolUser> {
        // unique enough!
        const id = Math.random().toString(16).substring(2, 10); // e.g., "a1b2c3d4"

        const email = `${POOL_PREFIX}.${id}@${POOL_DOMAIN}`;

        const userService = getUserService();

        const user = await userService.createUserDirect({
            email,
            password: POOL_PASSWORD,
            displayName:`pool user ${id}`,
            termsAccepted: true,
            cookiePolicyAccepted: true,
        });

        const token = await admin.auth().createCustomToken(user.uid);

        return {user, password: POOL_PASSWORD, token};
    }

    async getPoolStatus() {
        const poolRef = firestoreDb.collection(POOL_COLLECTION);
        const [availableSnapshot, borrowedSnapshot] = await Promise.all([
            poolRef.where('status', '==', 'available').get(),
            poolRef.where('status', '==', 'borrowed').get()
        ]);
        
        return {
            available: availableSnapshot.size,
            borrowed: borrowedSnapshot.size,
            total: availableSnapshot.size + borrowedSnapshot.size,
        }
    }

    // Force cleanup all borrows (for testing/admin use)
    async resetPool(): Promise<void> {
        const poolRef = firestoreDb.collection(POOL_COLLECTION);
        const borrowedSnapshot = await poolRef.where('status', '==', 'borrowed').get();
        
        const batch = firestoreDb.batch();
        borrowedSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
            batch.update(doc.ref, { status: 'available' });
        });
        
        if (borrowedSnapshot.size > 0) {
            await batch.commit();
        }
    }
}