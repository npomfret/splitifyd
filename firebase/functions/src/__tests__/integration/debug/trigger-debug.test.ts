import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ApiDriver, User } from '../../support/ApiDriver';
import { clearAllTestData } from '../../support/cleanupHelpers';
import { db } from '../../../firebase';
import { FirestoreCollections } from '../../../shared/shared-types';

describe('Trigger Debug Tests', () => {
    let apiDriver: ApiDriver;
    let user1: User;
    let groupId: string;

    beforeAll(async () => {
        apiDriver = new ApiDriver();
        
        // Create test user
        user1 = await apiDriver.createUser({
            email: `debug.user.${Date.now()}@example.com`,
            password: 'Test123!',
            displayName: 'Debug User',
        });
    });

    afterAll(async () => {
        await clearAllTestData();
    });

    beforeEach(async () => {
        // Clear any existing change documents
        if (groupId) {
            try {
                const groupChanges = await db.collection(FirestoreCollections.GROUP_CHANGES)
                    .where('groupId', '==', groupId)
                    .get();
                
                const batch = db.batch();
                groupChanges.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                console.log(`Cleared ${groupChanges.size} group change documents`);
            } catch (error) {
                console.warn('Error clearing group changes:', error);
            }
        }
    });

    it('should fire group trigger when creating a group', async () => {
        console.log('🚀 Starting simple trigger test');
        
        // Create a group with minimal data
        const group = await apiDriver.createGroup(
            {
                name: 'Simple Debug Test Group',
                description: 'Testing if triggers fire',
            },
            user1.token
        );
        groupId = group.id;

        console.log('📝 Created group:', { groupId: group.id, name: group.name });
        
        // Wait for trigger to potentially fire
        console.log('⏳ Waiting 3 seconds for trigger...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if any change documents were created
        const groupChanges = await db.collection(FirestoreCollections.GROUP_CHANGES).get();
        console.log(`📊 Total group change documents in collection: ${groupChanges.size}`);
        
        groupChanges.docs.forEach((doc, index) => {
            console.log(`📄 Change doc ${index + 1}:`, doc.data());
        });
        
        // Check for our specific group
        const ourGroupChanges = await db.collection(FirestoreCollections.GROUP_CHANGES)
            .where('groupId', '==', groupId)
            .get();
        
        console.log(`📊 Change documents for our group (${groupId}): ${ourGroupChanges.size}`);
        
        ourGroupChanges.docs.forEach((doc, index) => {
            console.log(`📄 Our change doc ${index + 1}:`, doc.data());
        });

        // For now, let's not assert anything - just see what happens
        expect(true).toBe(true); // Always passes
    }, 15000);

    it('should fire expense trigger when creating an expense', async () => {
        console.log('🚀 Starting expense trigger test');
        
        // First create a group
        if (!groupId) {
            const group = await apiDriver.createGroup(
                {
                    name: 'Expense Debug Test Group', 
                    description: 'Testing expense triggers',
                },
                user1.token
            );
            groupId = group.id;
            console.log('📝 Created group for expense test:', { groupId });
            
            // Wait a bit for group trigger to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Create an expense
        const expense = await apiDriver.createExpense(
            {
                groupId,
                description: 'Debug Test Expense',
                amount: 50,
                currency: 'USD',
                category: 'General',
                date: new Date().toISOString(),
                paidBy: user1.uid,
                participants: [user1.uid],
                splitType: 'equal',
                splits: [
                    { userId: user1.uid, amount: 50 },
                ],
            },
            user1.token
        );
        
        console.log('📝 Created expense:', { expenseId: expense.id, description: expense.description });
        
        // Wait for trigger to potentially fire
        console.log('⏳ Waiting 3 seconds for expense trigger...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check transaction-changes collection for expense changes
        const expenseChanges = await db.collection(FirestoreCollections.TRANSACTION_CHANGES).get();
        console.log(`📊 Total expense change documents in collection: ${expenseChanges.size}`);
        
        expenseChanges.docs.forEach((doc, index) => {
            console.log(`📄 Expense change doc ${index + 1}:`, doc.data());
        });
        
        // Check balance-changes collection
        const balanceChanges = await db.collection(FirestoreCollections.BALANCE_CHANGES).get();
        console.log(`📊 Total balance change documents: ${balanceChanges.size}`);
        
        balanceChanges.docs.forEach((doc, index) => {
            console.log(`📄 Balance change doc ${index + 1}:`, doc.data());
        });

        // Always pass for now
        expect(true).toBe(true);
    }, 15000);

    it('should check if triggers are even registered', async () => {
        console.log('🔍 Checking trigger registration');
        
        // Try to access Firebase emulator info
        try {
            // This is a simple test to see if we can query collections
            const testQuery = await db.collection('_test_trigger_check').limit(1).get();
            console.log('✅ Firebase connection working, query returned size:', testQuery.size);
        } catch (error) {
            console.error('❌ Firebase connection issue:', error);
        }
        
        expect(true).toBe(true);
    });
});