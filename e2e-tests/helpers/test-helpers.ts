import { Page, expect } from '@playwright/test';
import { CreateGroupModalPage, GroupDetailPage, DashboardPage } from '../pages';
import { EMULATOR_URL } from './emulator-utils';

/**
 * Creates a test group via the UI and returns the group ID
 */
export async function createTestGroup(
  page: Page, 
  groupName: string, 
  description?: string
): Promise<string> {
  const dashboardPage = new DashboardPage(page);
  const createGroupModal = new CreateGroupModalPage(page);
  
  // Navigate to dashboard if not already there
  if (!page.url().includes('/dashboard')) {
    await dashboardPage.navigate();
  }
  
  // Click create group button
  await page.getByRole('button', { name: /create.*group/i }).click();
  
  // Fill in group details
  await createGroupModal.createGroup(groupName, description);
  
  // Wait for navigation to group detail page
  await page.waitForURL(/\/groups\/[^/]+$/);
  
  // Extract group ID from URL
  const url = page.url();
  const groupId = url.substring(url.lastIndexOf('/') + 1);
  
  return groupId;
}

/**
 * Adds an expense to a group via the UI
 */
export async function addTestExpense(
  page: Page,
  groupId: string,
  amount: number,
  description: string,
  options?: {
    paidBy?: string;
    category?: string;
    splitType?: 'equal' | 'exact' | 'percentage';
    participants?: string[];
    splits?: Array<{ userId: string; amount?: number; percentage?: number }>;
  }
): Promise<void> {
  const groupDetailPage = new GroupDetailPage(page);
  
  // Navigate to group if not already there
  if (!page.url().includes(`/groups/${groupId}`)) {
    await groupDetailPage.navigate(groupId);
  }
  
  // Click add expense button
  await page.getByRole('button', { name: /add.*expense/i }).click();
  
  // Wait for add expense page
  await page.waitForURL(/\/groups\/[^/]+\/expenses\/add/);
  
  // Fill in basic expense details
  await page.getByLabel(/description/i).fill(description);
  await page.getByLabel(/amount/i).fill(amount.toString());
  
  // Set optional fields if provided
  if (options?.category) {
    await page.getByRole('button', { name: /category/i }).click();
    await page.getByRole('option', { name: new RegExp(options.category, 'i') }).click();
  }
  
  if (options?.splitType && options.splitType !== 'equal') {
    // Click split type selector
    const splitTypeButton = page.getByRole('button', { name: /split.*equal/i })
      .or(page.getByText(/split.*equal/i));
    await splitTypeButton.click();
    
    // Select split type
    await page.getByRole('option', { name: new RegExp(options.splitType, 'i') }).click();
    
    // Handle custom splits if provided
    if (options.splits) {
      for (const split of options.splits) {
        if (options.splitType === 'exact' && split.amount !== undefined) {
          await page.getByTestId(`split-amount-${split.userId}`)
            .or(page.locator(`[data-user-id="${split.userId}"] input[type="number"]`))
            .fill(split.amount.toString());
        } else if (options.splitType === 'percentage' && split.percentage !== undefined) {
          await page.getByTestId(`split-percentage-${split.userId}`)
            .or(page.locator(`[data-user-id="${split.userId}"] input[type="number"]`))
            .fill(split.percentage.toString());
        }
      }
    }
  }
  
  // Submit the expense
  await page.getByRole('button', { name: /add.*expense/i }).click();
  
  // Wait for navigation back to group page
  await page.waitForURL(/\/groups\/[^/]+$/);
}

/**
 * Retrieves the current balance state for a group
 */
export async function getGroupBalances(
  page: Page,
  groupId: string
): Promise<{
  totalOwed: number;
  totalOwing: number;
  balances: Array<{ from: string; to: string; amount: number }>;
}> {
  const groupDetailPage = new GroupDetailPage(page);
  
  // Navigate to group if not already there
  if (!page.url().includes(`/groups/${groupId}`)) {
    await groupDetailPage.navigate(groupId);
  }
  
  // Wait for balance section to load
  await page.waitForSelector('[data-testid="balance-summary"], .balance-summary, [class*="balance"]', {
    timeout: 2000
  });
  
  // Check if group is settled
  const settledText = await page.getByText(/all.*settled.*up/i).isVisible().catch(() => false);
  if (settledText) {
    return {
      totalOwed: 0,
      totalOwing: 0,
      balances: []
    };
  }
  
  // Extract balance information
  const balances: Array<{ from: string; to: string; amount: number }> = [];
  
  // Look for balance items (e.g., "Alice owes Bob $10.00")
  const balanceElements = await page.locator('[data-testid*="balance-item"], [class*="balance-item"]').all();
  
  for (const element of balanceElements) {
    const text = await element.textContent();
    if (text) {
      // Parse balance text (format: "Person1 owes Person2 $X.XX")
      const match = text.match(/(.+?)\s+owes?\s+(.+?)\s+\$?([\d,]+\.?\d*)/i);
      if (match) {
        balances.push({
          from: match[1].trim(),
          to: match[2].trim(),
          amount: parseFloat(match[3].replace(/,/g, ''))
        });
      }
    }
  }
  
  // Calculate totals
  const totalOwed = balances.reduce((sum, b) => sum + b.amount, 0);
  const totalOwing = totalOwed; // In a balanced system, these should match
  
  return {
    totalOwed,
    totalOwing,
    balances
  };
}


/**
 * Waits for balance recalculation to complete
 */
export async function waitForBalanceUpdate(
  page: Page,
  options?: { timeout?: number }
): Promise<void> {
  // Wait for any loading indicators to disappear
  await page.waitForSelector('.loading, [data-testid="loading"], [class*="spinner"]', {
    state: 'hidden',
    timeout: options?.timeout || 2000
  }).catch(() => {});
  
  // Wait for network to be idle (no ongoing balance calculations)
  await page.waitForLoadState('networkidle', { timeout: options?.timeout || 2000 });
  
  // Additional wait for any animations
  await page.waitForTimeout(200);
}

/**
 * Gets the list of expenses for a group
 */
export async function getGroupExpenses(
  page: Page,
  groupId: string
): Promise<Array<{
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: string;
}>> {
  const groupDetailPage = new GroupDetailPage(page);
  
  // Navigate to group if not already there
  if (!page.url().includes(`/groups/${groupId}`)) {
    await groupDetailPage.navigate(groupId);
  }
  
  // Wait for expenses list to load
  await page.waitForSelector('[data-testid="expenses-list"], [class*="expense"]', {
    timeout: 2000
  });
  
  const expenses: Array<{
    id: string;
    description: string;
    amount: number;
    paidBy: string;
    date: string;
  }> = [];
  
  // Get all expense items
  const expenseElements = await page.locator('[data-testid*="expense-item"], [class*="expense-item"]').all();
  
  for (const element of expenseElements) {
    const description = await element.locator('[data-testid="expense-description"], [class*="description"]').textContent() || '';
    const amountText = await element.locator('[data-testid="expense-amount"], [class*="amount"]').textContent() || '';
    const paidByText = await element.locator('[data-testid="expense-paid-by"], [class*="paid"]').textContent() || '';
    const dateText = await element.locator('[data-testid="expense-date"], [class*="date"]').textContent() || '';
    
    // Extract amount from text (remove $ and commas)
    const amount = parseFloat(amountText.replace(/[$,]/g, ''));
    
    // Extract paid by name
    const paidBy = paidByText.replace(/paid by:?/i, '').trim();
    
    // Generate a simple ID (in real app, would get from data attribute)
    const id = `expense-${Date.now()}-${Math.random()}`;
    
    expenses.push({
      id,
      description: description.trim(),
      amount,
      paidBy,
      date: dateText.trim()
    });
  }
  
  return expenses;
}

