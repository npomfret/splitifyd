import {getAuth, getFirestore} from '../firebase';
import {runTransactionWithRetry} from '../utils/firestore-helpers';
import {Timestamp} from "firebase-admin/firestore";
import type {IFirestoreReader} from '../services/firestore/IFirestoreReader';
import {UserService} from "../services/UserService2";

export interface PoolUser {
    token: string
    email: string
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

    private constructor(private readonly firestoreReader: IFirestoreReader, private readonly userService: UserService) {
    }

    static getInstance(firestoreReader: IFirestoreReader, userService: UserService): TestUserPoolService {
        if (!TestUserPoolService.instance) {
            TestUserPoolService.instance = new TestUserPoolService(firestoreReader, userService);
        }
        return TestUserPoolService.instance;
    }

    async borrowUser(): Promise<PoolUser> {
        // Use transaction to atomically claim an available user
        const result = await runTransactionWithRetry(
            async (transaction) => {
                // Query for available users using FirestoreReader
                const availableUsers = await this.firestoreReader.getTestUsersByStatus('available', 1);
                
                if (availableUsers.length > 0) {
                    // Found an available user - claim it atomically
                    const doc = availableUsers[0];
                    const data = doc.data() as FirestorePoolUser;
                    
                    // Update status to borrowed within transaction
                    transaction.update(doc.ref, { status: 'borrowed' });
                    
                    return {
                        email: data.email,
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
            return {// todo: this should problably be a PooledTestUser
                email: result.email!,
                token: result.token!,
                password: result.password!
            };
        }
        
        // No available users found - create a new one
        // This is done outside transaction since createUser() involves Auth API calls
        const newUser = await this.createUser();
        await getFirestore().collection(POOL_COLLECTION).doc(newUser.email).set({
            email: newUser.email,
            token: newUser.token,
            password: newUser.password,
            status: 'borrowed' as const,
            createdAt: Timestamp.now()
        });
        return newUser;
    }

    async returnUser(email: string): Promise<void> {
        const poolRef = getFirestore().collection(POOL_COLLECTION);
        
        // Use transaction to atomically return user
        await runTransactionWithRetry(
            async (transaction) => {
                const doc = await this.firestoreReader.getRawDocumentInTransactionWithRef(transaction, poolRef.doc(email));
                
                if (!doc) {
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

        const user = await this.userService.createUserDirect({
            email,
            password: POOL_PASSWORD,
            displayName:`pool user ${id}`,
            termsAccepted: true,
            cookiePolicyAccepted: true,
        });

        const token = await getAuth().createCustomToken(user.uid);

        return {email, password: POOL_PASSWORD, token};
    }

    async getPoolStatus() {
        return this.firestoreReader.getTestUserPoolStatus();
    }

    // Force cleanup all borrows (for testing/admin use)
    async resetPool(): Promise<void> {
        const borrowedDocs = await this.firestoreReader.getBorrowedTestUsers();
        
        const batch = getFirestore().batch();
        borrowedDocs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
            batch.update(doc.ref, { status: 'available' });
        });
        
        if (borrowedDocs.length > 0) {
            await batch.commit();
        }
    }
}