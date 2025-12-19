import type { Email } from '@billsplit-wl/shared';
import { toDisplayName, toEmail, toPassword, toTenantId } from '@billsplit-wl/shared';
import type { IAuthService } from '../services/auth';
import type { IFirestoreWriter } from '../services/firestore';
import { UserService } from '../services/UserService2';

interface PoolUser {
    token: string;
    email: Email;
    password: string;
}

const POOL_PREFIX = 'testpool';
const POOL_DOMAIN = 'example.com';
const POOL_PASSWORD = 'passwordpass';

export class TestUserPoolService {
    private static instance: TestUserPoolService;

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
        // Try to atomically claim an available user from the pool
        const result = await this.firestoreWriter.borrowAvailableTestPoolUser();

        if (result) {
            return result;
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

        const email = toEmail(`${POOL_PREFIX}.${id}@${POOL_DOMAIN}`);

        const user = await this.userService.createUserDirect({
            email,
            password: toPassword(POOL_PASSWORD),
            displayName: toDisplayName(`pool user ${id}`),
            termsAccepted: true,
            cookiePolicyAccepted: true,
            privacyPolicyAccepted: true,
            signupHostname: 'localhost',
        }, toTenantId('test-tenant'));

        const token = await this.authService.createCustomToken(user.uid);

        return { email, password: POOL_PASSWORD, token };
    }
}
