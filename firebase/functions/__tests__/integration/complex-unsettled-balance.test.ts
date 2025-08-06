/**
 * Integration test to reproduce the complex unsettled group scenario
 * This test creates the exact same scenario as the failing E2E test to determine
 * if the balance calculation issue is in the backend or frontend
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ApiDriver, User } from '../support/ApiDriver';
import { v4 as uuidv4 } from 'uuid';
import { UserBuilder } from '../support/builders/UserBuilder';
import { GroupBuilder } from '../support/builders/GroupBuilder';
import { ExpenseBuilder } from '../support/builders/ExpenseBuilder';

describe('Complex Unsettled Balance - API Integration Test', () => {
  let driver: ApiDriver;
  let alice: User;
  let bob: User;

  beforeEach(async () => {
    driver = new ApiDriver();
    
    // Create two users like in the E2E test
    alice = await driver.createUser(new UserBuilder().withEmail(`alice-${uuidv4()}@test.com`).build());
    bob = await driver.createUser(new UserBuilder().withEmail(`bob-${uuidv4()}@test.com`).build());
  });

  afterEach(async () => {
    // Clean up - Note: User deletion not available in test API
  });

  test('should show correct balances when multiple users create expenses with equal split', async () => {
    // Create group with Alice (same as E2E test)
    const groupData = new GroupBuilder()
      .withName('Vacation Trip 2024')
      .withDescription('Beach house rental and activities')
      .build();
    const group = await driver.createGroup(groupData, alice.token);
    
    // Add Bob to the group
    const shareLink = await driver.generateShareLink(group.id, alice.token);
    await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);
    
    // Verify both members are in the group
    const groupAfterJoin = await driver.getGroup(group.id, alice.token);
    expect(groupAfterJoin.members).toHaveLength(2);
    expect(groupAfterJoin.members).toContainEqual(expect.objectContaining({ uid: alice.uid }));
    expect(groupAfterJoin.members).toContainEqual(expect.objectContaining({ uid: bob.uid }));
    
    // Alice adds beach house expense ($800) - paid by Alice, split equally among all
    const expense1Data = new ExpenseBuilder()
      .withGroupId(group.id)
      .withDescription('Beach House Rental')
      .withAmount(80000) // $800.00 in cents
      .withPaidBy(alice.uid)
      .withSplitType('equal')
      .withParticipants([alice.uid, bob.uid]) // Both participants
      .build();
    
    await driver.createExpense(expense1Data, alice.token);

    // Bob adds restaurant expense ($120) - paid by Bob, split equally among all
    const expense2Data = new ExpenseBuilder()
      .withGroupId(group.id)
      .withDescription('Restaurant Dinner')
      .withAmount(12000) // $120.00 in cents
      .withPaidBy(bob.uid)
      .withSplitType('equal')
      .withParticipants([alice.uid, bob.uid]) // Both participants
      .build();
    
    await driver.createExpense(expense2Data, bob.token);

    // Get the group balance
    const balances = await driver.getGroupBalances(group.id, alice.token);

    // Verify the balance calculation
    // Alice paid $800, Bob paid $120, total = $920
    // Each person's share = $920 / 2 = $460
    // Alice should be owed: $800 - $460 = $340
    // Bob should owe: $460 - $120 = $340
    
    expect(balances.simplifiedDebts).toBeDefined();
    expect(balances.simplifiedDebts.length).toBeGreaterThan(0);
    
    // The simplified debts should show Bob owes Alice $340
    const debt = balances.simplifiedDebts.find(
      (d: any) => d.from.userId === bob.uid && d.to.userId === alice.uid
    );
    expect(debt).toBeDefined();
    expect(debt?.amount).toBe(34000); // $340.00 in cents
    
    // Check individual balances
    expect(balances.userBalances[alice.uid]).toBeDefined();
    expect(balances.userBalances[alice.uid].netBalance).toBe(34000); // Alice is owed $340
    
    expect(balances.userBalances[bob.uid]).toBeDefined();
    expect(balances.userBalances[bob.uid].netBalance).toBe(-34000); // Bob owes $340
    
    // Also check via the group endpoint to see what the frontend receives
    const groupWithBalance = await driver.getGroup(group.id, alice.token);

    // The group balance should show that there are unsettled amounts
    expect(groupWithBalance.balance).toBeDefined();
    expect(groupWithBalance.balance.userBalance).toBeDefined();
    expect(groupWithBalance.balance.userBalance!.netBalance).toBe(34000); // Alice is owed $340
    expect(groupWithBalance.balance.totalOwed).toBe(34000); // Total Alice is owed
    expect(groupWithBalance.balance.totalOwing).toBe(0); // Alice owes nothing
  });
});