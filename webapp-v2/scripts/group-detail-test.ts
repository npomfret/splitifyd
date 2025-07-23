/**
 * Fast browser test for Group Detail page functionality
 * Optimized for speed with targeted tests
 */

import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
const envPath = join(process.cwd(), '../firebase/functions/.env');
config({ path: envPath });

const DEV_FORM_EMAIL = process.env.DEV_FORM_EMAIL || 'test1@test.com';
const DEV_FORM_PASSWORD = process.env.DEV_FORM_PASSWORD || 'rrRR44$$';

export interface GroupDetailTestConfig {
  baseUrl: string;
  credentials: {
    email: string;
    password: string;
  };
  groupId: string; // We'll use the first group from dashboard
}

export const GROUP_DETAIL_TEST_CONFIG: GroupDetailTestConfig = {
  baseUrl: 'http://localhost:6002',
  credentials: {
    email: DEV_FORM_EMAIL,
    password: DEV_FORM_PASSWORD
  },
  groupId: '' // Will be populated dynamically
};

export const GROUP_DETAIL_SELECTORS = {
  // Navigation
  groupCard: '[data-testid="group-card"]',
  groupLink: 'a[href*="/groups/"]',
  
  // Group Header
  groupTitle: 'h1',
  groupDescription: '.text-gray-600',
  settingsButton: 'button:has-text("Settings")',
  memberCount: ':text("members")',
  expenseCount: ':text("expenses")',
  
  // Quick Actions
  addExpenseBtn: 'button:has-text("Add Expense")',
  settleUpBtn: 'button:has-text("Settle Up")',
  shareBtn: 'button:has-text("Share Group")',
  
  // Members Section
  membersSection: ':text("Members")',
  memberAvatar: '.bg-primary-100',
  memberName: '.text-sm.font-medium',
  adminBadge: ':text("Admin")',
  
  // Balances Section
  balancesSection: ':text("Balances")',
  debtItem: '.text-red-600',
  allSettledMessage: ':text("All settled up!")',
  
  // Expenses Section
  expensesSection: ':text("Expenses")',
  expenseItem: '.cursor-pointer.hover\\:bg-gray-50',
  expenseDescription: '.font-medium',
  expenseAmount: '.font-semibold',
  loadMoreBtn: 'button:has-text("Load More")',
  noExpensesMessage: ':text("No expenses yet")',
  
  // Loading states
  loadingSpinner: '.animate-spin',
  
  // Error states
  errorMessage: ':text("Error Loading Group")',
  notFoundMessage: ':text("Group Not Found")',
  backToDashboardBtn: 'button:has-text("Back to Dashboard")'
};

export function getTestPlan() {
  return {
    name: 'Group Detail Page Tests',
    description: 'Fast targeted tests for group detail functionality',
    estimatedTime: '60 seconds',
    
    phases: [
      {
        name: 'Setup & Navigation',
        duration: '15s',
        steps: [
          'Login to application',
          'Navigate to dashboard',
          'Find first group and get ID',
          'Navigate to group detail page'
        ]
      },
      {
        name: 'Core Components',
        duration: '25s',
        steps: [
          'Verify group header loads',
          'Check member list displays',
          'Validate balance calculations',
          'Test expense list pagination'
        ]
      },
      {
        name: 'Interactions',
        duration: '15s',
        steps: [
          'Test quick action buttons',
          'Click expense items',
          'Test load more functionality',
          'Verify responsive layout'
        ]
      },
      {
        name: 'Error Handling',
        duration: '5s',
        steps: [
          'Test invalid group ID',
          'Verify error messages display'
        ]
      }
    ],
    
    optimizations: [
      'Skip authentication setup (reuse existing session)',
      'Use CSS selectors instead of XPath for speed',
      'Test multiple features in single page load',
      'Use data-testid attributes where possible',
      'Batch similar assertions together'
    ]
  };
}

export function logTestPlan() {
  const plan = getTestPlan();
  
  console.log('🧪 Group Detail Browser Tests');
  console.log(`📊 Estimated time: ${plan.estimatedTime}`);
  console.log(`🎯 ${plan.description}`);
  console.log('');
  
  console.log('📋 Test Phases:');
  plan.phases.forEach((phase, index) => {
    console.log(`\n${index + 1}. ${phase.name} (${phase.duration})`);
    phase.steps.forEach(step => console.log(`   ✓ ${step}`));
  });
  
  console.log('\n⚡ Speed Optimizations:');
  plan.optimizations.forEach(opt => console.log(`   • ${opt}`));
  
  console.log('\n🔗 Test URL Pattern: http://localhost:6002/v2/groups/{groupId}');
  console.log('📝 Use MCP browser automation tools to execute these tests');
}

if (require.main === module) {
  logTestPlan();
}