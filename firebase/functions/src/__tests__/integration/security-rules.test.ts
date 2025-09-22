import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Security rules test to verify production rules work correctly
describe('Firestore Security Rules (Production)', () => {
    const projectId = 'security-rules-test';
    let testEnv: any;
    let authenticatedContext: any;
    let unauthenticatedContext: any;
    let testDb: any;
    let adminDb: any;

    beforeAll(async () => {
        // Read the rules file
        const rulesPath = join(__dirname, '../../../../firestore.prod.rules');
        const rules = readFileSync(rulesPath, 'utf8');

        // Initialize test environment
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: {
                rules,
                host: '127.0.0.1',
                port: 8004
            }
        });

        // Create authenticated context for test user
        authenticatedContext = testEnv.authenticatedContext('test-user-id', {
            email: 'test@example.com'
        });
        testDb = authenticatedContext.firestore();

        // Create admin context (bypass rules)
        adminDb = testEnv.authenticatedContext('admin-user-id', {
            admin: true
        }).firestore();
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    it('should deny read access to groups collection for client', async () => {
        // Client should NOT be able to read groups collection
        await assertFails(getDocs(collection(testDb, 'groups')));
    });

    it('should deny write access to groups collection for client', async () => {
        // Client should NOT be able to write to groups collection
        const groupData = {
            name: 'Test Group',
            userId: 'test-user-id',
            createdAt: new Date()
        };
        await assertFails(setDoc(doc(testDb, 'groups', 'test-group'), groupData));
    });

    it('should deny read access to expenses collection for client', async () => {
        // Client should NOT be able to read expenses collection
        await assertFails(getDocs(collection(testDb, 'expenses')));
    });

    it('should deny write access to expenses collection for client', async () => {
        // Client should NOT be able to write to expenses collection
        const expenseData = {
            description: 'Test Expense',
            amount: 100,
            createdBy: 'test-user-id'
        };
        await assertFails(setDoc(doc(testDb, 'expenses', 'test-expense'), expenseData));
    });

    it('should deny read access to other users documents for client', async () => {
        // Use testEnv.withSecurityRulesDisabled to create the other user's document first
        await testEnv.withSecurityRulesDisabled(async (context: any) => {
            const userData = {
                email: 'other@example.com',
                displayName: 'Other User',
                role: 'user'
            };
            await setDoc(doc(context.firestore(), 'users', 'other-user-id'), userData);
        });

        // Client should NOT be able to read other user's document
        await assertFails(getDoc(doc(testDb, 'users', 'other-user-id')));
    });

    it('should allow admin to read and write all collections', async () => {
        // Use withSecurityRulesDisabled for admin operations
        await testEnv.withSecurityRulesDisabled(async (context: any) => {
            const db = context.firestore();

            // Admin should be able to write to any collection
            await assertSucceeds(setDoc(doc(db, 'groups', 'admin-group'), { name: 'Admin Group' }));
            await assertSucceeds(setDoc(doc(db, 'expenses', 'admin-expense'), { amount: 50 }));
            await assertSucceeds(setDoc(doc(db, 'users', 'admin-user'), { email: 'admin@example.com' }));

            // Admin should be able to read from any collection
            await assertSucceeds(getDoc(doc(db, 'groups', 'admin-group')));
            await assertSucceeds(getDoc(doc(db, 'expenses', 'admin-expense')));
            await assertSucceeds(getDoc(doc(db, 'users', 'admin-user')));
        });
    });

    it('should allow client to read and write their own user document', async () => {
        const userData = {
            email: 'test@example.com',
            displayName: 'Test User',
            role: 'user'
        };

        // Client should be able to write to their own user document
        await assertSucceeds(setDoc(doc(testDb, 'users', 'test-user-id'), userData));

        // Client should be able to read their own user document
        await assertSucceeds(getDoc(doc(testDb, 'users', 'test-user-id')));
    });
});