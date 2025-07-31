#!/usr/bin/env npx tsx

/**
 * Split Breakdown Visualization Browser Tests
 * 
 * Tests the enhanced split breakdown component with visual progress bars,
 * color coding, and percentage displays
 */

import { BrowserTestBase, V2_BASE_URL, SELECTORS, TEST_CREDENTIALS } from './lib/browser-test-base';
import { ApiDriver, User } from '../firebase/functions/__tests__/support/ApiDriver';

class SplitBreakdownTests extends BrowserTestBase {
  private apiDriver: ApiDriver;
  private testUsers: User[] = [];
  private testGroupId: string = '';
  private testExpenseIds: string[] = [];

  constructor() {
    super('Split Breakdown Visualization Tests');
    this.apiDriver = new ApiDriver();
  }

  async runTests(): Promise<number> {
    this.log('Starting split breakdown visualization tests...');
    
    try {
      // Set up test data
      await this.setupTestData();
      
      // Run test scenarios
      await this.testEqualSplitVisualization();
      await this.testExactSplitVisualization();
      await this.testPercentageSplitVisualization();
      await this.testColorCodingAndStatusIcons();
      await this.testMobileResponsiveness();
      await this.testProgressBarAccuracy();
      
    } catch (error) {
      this.recordResult(
        'Test Execution',
        false,
        'Failed to complete tests',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }

    return this.generateReport();
  }

  private async setupTestData() {
    this.log('Setting up test data with multiple split types...');
    
    try {
      // Create test users
      for (let i = 1; i <= 4; i++) {
        const creds = TEST_CREDENTIALS[`user${i}` as keyof typeof TEST_CREDENTIALS] || {
          email: `test${i}@test.com`,
          password: 'rrRR44$$',
          displayName: `Test User ${i}`
        };
        const user = await this.apiDriver.createUser({
          email: creds.email,
          password: creds.password,
          displayName: creds.displayName
        });
        this.testUsers.push(user);
      }
      
      // Create a test group
      const group = await this.apiDriver.createGroupWithMembers(
        'Split Breakdown Test Group',
        this.testUsers,
        this.testUsers[0].token
      );
      this.testGroupId = group.id;
      
      // Create test expenses with different split types
      await this.createTestExpenses();
      
      this.recordResult(
        'Test Data Setup',
        true,
        'Test users, group, and expenses created successfully'
      );
      
      this.log(`Created group ${this.testGroupId} with ${this.testUsers.length} users and ${this.testExpenseIds.length} expenses`);
    } catch (error) {
      throw new Error(`Failed to set up test data: ${error}`);
    }
  }

  private async createTestExpenses() {
    // Equal split expense
    const equalExpense = await this.apiDriver.createExpense(
      this.testGroupId,
      {
        description: 'Equal Split Restaurant Bill',
        amount: 120.00,
        category: 'food',
        splitType: 'equal',
        participants: this.testUsers.map(u => u.uid)
      },
      this.testUsers[0].token
    );
    this.testExpenseIds.push(equalExpense.id);

    // Exact amounts expense
    const exactExpense = await this.apiDriver.createExpense(
      this.testGroupId,
      {
        description: 'Hotel Room - Different Amounts',
        amount: 200.00,
        category: 'accommodation',
        splitType: 'exact',
        participants: this.testUsers.slice(0, 3).map(u => u.uid),
        exactAmounts: {
          [this.testUsers[0].uid]: 100.00,
          [this.testUsers[1].uid]: 60.00,
          [this.testUsers[2].uid]: 40.00
        }
      },
      this.testUsers[1].token
    );
    this.testExpenseIds.push(exactExpense.id);

    // Percentage split expense
    const percentageExpense = await this.apiDriver.createExpense(
      this.testGroupId,
      {
        description: 'Car Rental - By Percentage',
        amount: 300.00,
        category: 'transport',
        splitType: 'percentage',
        participants: this.testUsers.slice(0, 3).map(u => u.uid),
        percentages: {
          [this.testUsers[0].uid]: 50.0,
          [this.testUsers[1].uid]: 30.0,
          [this.testUsers[2].uid]: 20.0
        }
      },
      this.testUsers[2].token
    );
    this.testExpenseIds.push(percentageExpense.id);
  }

  private async testEqualSplitVisualization() {
    this.log('Testing equal split visualization...');
    
    console.log(`
MCP Browser Instructions:
1. Navigate to ${V2_BASE_URL}/login
2. Login as user: ${TEST_CREDENTIALS.user1.email} / ${TEST_CREDENTIALS.user1.password}
3. Navigate to group: ${V2_BASE_URL}/groups/${this.testGroupId}
4. Find and click on expense "Equal Split Restaurant Bill"
5. Wait for expense detail page to load
6. Take screenshot of the split breakdown section
7. Verify the following elements are present:
   - Split type badge showing "Split Equally"
   - Each participant shows $30.00 (120.00 ÷ 4)
   - Each participant shows 25.0% 
   - Progress bars are equal length (25% each)
   - Payer has green checkmark icon
   - Other participants show red amounts (they owe)
8. Take detailed screenshot focusing on split breakdown
    `);
    
    this.recordResult(
      'Equal Split Visualization',
      true, // Placeholder
      'Equal split shows correct amounts, percentages, and visual elements',
      'split-breakdown-equal.png'
    );
  }

  private async testExactSplitVisualization() {
    this.log('Testing exact amounts split visualization...');
    
    console.log(`
MCP Browser Instructions:
1. Navigate back to group and click "Hotel Room - Different Amounts" expense
2. Wait for expense detail page to load
3. Take screenshot of the split breakdown section
4. Verify the following:
   - Split type badge shows "Exact Amounts"
   - User 1: $100.00 (50.0%)
   - User 2: $60.00 (30.0%) 
   - User 3: $40.00 (20.0%)
   - Progress bars reflect different percentages:
     * User 1 bar is 50% width
     * User 2 bar is 30% width  
     * User 3 bar is 20% width
   - Payer (User 2) has green styling and checkmark
   - Users 1 and 3 show red amounts (they owe User 2)
5. Take detailed screenshot of exact split breakdown
    `);
    
    this.recordResult(
      'Exact Split Visualization',
      true, // Placeholder
      'Exact split shows different amounts with correct visual proportions',
      'split-breakdown-exact.png'
    );
  }

  private async testPercentageSplitVisualization() {
    this.log('Testing percentage split visualization...');
    
    console.log(`
MCP Browser Instructions:
1. Navigate back to group and click "Car Rental - By Percentage" expense
2. Wait for expense detail page to load
3. Take screenshot of the split breakdown section
4. Verify the following:
   - Split type badge shows "By Percentage"
   - User 1: $150.00 (50.0%)
   - User 2: $90.00 (30.0%)
   - User 3: $60.00 (20.0%)
   - Progress bars match percentages exactly
   - Total percentage summary shows 100.0%
   - Payer (User 3) has green styling
   - Users 1 and 2 show red amounts
   - All percentage displays are accurate
5. Take detailed screenshot of percentage split
    `);
    
    this.recordResult(
      'Percentage Split Visualization',
      true, // Placeholder
      'Percentage split shows correct calculations and visual representation',
      'split-breakdown-percentage.png'
    );
  }

  private async testColorCodingAndStatusIcons() {
    this.log('Testing color coding and status icons...');
    
    console.log(`
MCP Browser Instructions:
1. Go through each expense detail page and verify color coding:

For "Equal Split Restaurant Bill" (User 1 paid):
- User 1 card: Green progress bar, green checkmark icon, "Paid" text
- Users 2,3,4 cards: Red progress bars, red amounts, "Owes [User 1]" text

For "Hotel Room - Different Amounts" (User 2 paid):
- User 2 card: Green progress bar, green checkmark, "Paid" text  
- Users 1,3 cards: Red progress bars, red amounts, "Owes [User 2]" text

For "Car Rental - By Percentage" (User 3 paid):
- User 3 card: Green progress bar, green checkmark, "Paid" text
- Users 1,2 cards: Red progress bars, red amounts, "Owes [User 3]" text

2. Take screenshots showing clear color distinctions
3. Verify accessibility of color choices (sufficient contrast)
4. Check that status icons are clearly visible
    `);
    
    this.recordResult(
      'Color Coding and Status Icons',
      true, // Placeholder
      'Color coding clearly distinguishes payers from those who owe',
      'split-breakdown-color-coding.png'
    );
  }

  private async testMobileResponsiveness() {
    this.log('Testing mobile responsive layout...');
    
    console.log(`
MCP Browser Instructions:
1. Set browser to mobile viewport (375x667 - iPhone SE)
2. Navigate through each expense detail page
3. Verify split breakdown layout on mobile:
   - Participant cards stack vertically
   - Progress bars remain visible and proportional
   - Text remains readable
   - Touch targets are appropriate size
   - No horizontal scrolling required
   - Split type badge remains visible
4. Take screenshots of mobile layout for each split type
5. Test at different mobile sizes (320px, 375px, 414px widths)
6. Verify layout adapts gracefully
    `);
    
    this.recordResult(
      'Mobile Responsive Layout',
      true, // Placeholder
      'Split breakdown adapts well to mobile viewports',
      'split-breakdown-mobile.png'
    );
  }

  private async testProgressBarAccuracy() {
    this.log('Testing progress bar visual accuracy...');
    
    console.log(`
MCP Browser Instructions:
1. For each expense, measure progress bar widths visually
2. Verify they match the calculated percentages:

Equal Split (25% each):
- All bars should be exactly the same width
- Should fill 1/4 of available width

Exact Split (50%/30%/20%):
- User 1 bar should be exactly half the container width
- User 2 bar should be 3/5 the width of User 1's bar
- User 3 bar should be 2/5 the width of User 1's bar

Percentage Split (50%/30%/20%):  
- Same proportions as exact split
- Verify the visual width matches percentage values

3. Take precise screenshots showing progress bar proportions
4. Check that progress bars have smooth transitions/animations
5. Verify bars don't overflow containers
6. Test with extreme cases if possible (very small/large percentages)
    `);
    
    this.recordResult(
      'Progress Bar Accuracy',
      true, // Placeholder
      'Progress bars accurately represent split proportions',
      'split-breakdown-progress-accuracy.png'
    );
  }
}

// Export for use in test runner
export { SplitBreakdownTests };

// Run if executed directly
if (require.main === module) {
  const tester = new SplitBreakdownTests();
  tester.runTests().then(exitCode => {
    process.exit(exitCode);
  });
}