import {admin} from '../firebase';
import {getUserService} from '../services/serviceRegistration';
import {User} from "@splitifyd/shared";

interface PoolUser {
    user: User,
    token: string
    password: string
}

const POOL_PREFIX = 'testpool';
const POOL_DOMAIN = 'example.com';
const POOL_PASSWORD = 'rrRR44$$';

export class TestUserPoolService {
    private static instance: TestUserPoolService;

    private available: Map<string, PoolUser> = new Map();// key = poolUser.email
    private borrowed: Map<string, PoolUser> = new Map();// key = poolUser.email

    private constructor() {
    }

    static getInstance(): TestUserPoolService {
        if (!TestUserPoolService.instance) {
            TestUserPoolService.instance = new TestUserPoolService();
        }
        return TestUserPoolService.instance;
    }

    async borrowUser(): Promise<PoolUser> {
        const poolUser = this.available.values().next().value;

        if (poolUser === undefined) {
            const newUser = await this.createUser();
            this.borrowed.set(newUser.user.email, newUser);
            return newUser;
        } else {
            // Move from available to borrowed
            this.available.delete(poolUser!.user.email);
            this.borrowed.set(poolUser!.user.email, poolUser);

            return poolUser;
        }
    }

    returnUser(email: string) {
        if (this.borrowed.has(email)) {
            const poolUser = this.borrowed.get(email)!;
            this.borrowed.delete(email);
            this.available.set(email, poolUser);
        } else {
            throw Error(`User ${email} not found in borrowed pool`);
        }
    }

    private async createUser(): Promise<PoolUser> {
        // unique enough!
        const id = Math.random().toString(16).substring(2, 10); // e.g., "a1b2c3d4"

        console.log("createUser", {id});

        const email = `${POOL_PREFIX}.${id}@${POOL_DOMAIN}`;

        const userService = getUserService();

        const user = await userService.createUserDirect(
            email,
            POOL_PASSWORD,
            `pool user ${id}`,
            true,
            true,
        );

        const token = await admin.auth().createCustomToken(user.uid);
        return {user, password: POOL_PASSWORD, token};
    }

    getPoolStatus() {
        return {
            available: this.available.size,
            borrowed: this.borrowed.size,
            total: this.poolSize(),
        }
    }

    private poolSize() {
        return this.available.size + this.borrowed.size;
    }

    // Force cleanup all borrows (for testing/admin use)
    resetPool(): void {
        for (const email of this.borrowed.keys()) {
            this.returnUser(email)
        }
    }
}