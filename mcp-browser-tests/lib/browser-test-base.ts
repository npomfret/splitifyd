import { join } from 'path';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
const envPath = join(process.cwd(), 'firebase/functions/.env');
config({ path: envPath });

// Get ports from firebase.json
const firebaseConfig = JSON.parse(readFileSync(join(process.cwd(), 'firebase/firebase.json'), 'utf-8'));
export const HOSTING_PORT = firebaseConfig.emulators?.hosting?.port || 6002;
export const BASE_URL = `http://localhost:${HOSTING_PORT}`;
export const V2_BASE_URL = `${BASE_URL}/v2`;

// Test credentials
export const TEST_CREDENTIALS = {
  user1: {
    email: process.env.DEV_FORM_EMAIL || 'test1@test.com',
    password: process.env.DEV_FORM_PASSWORD || 'rrRR44$$',
    displayName: 'Test User 1'
  },
  user2: {
    email: 'test2@test.com',
    password: 'rrRR44$$',
    displayName: 'Test User 2'
  },
  user3: {
    email: 'test3@test.com',
    password: 'rrRR44$$',
    displayName: 'Test User 3'
  }
};

// Common selectors
export const SELECTORS = {
  auth: {
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
    loginButton: 'button:has-text("Login")',
    signupButton: 'button:has-text("Sign Up")',
    logoutButton: 'button[aria-label="Logout"]'
  },
  dashboard: {
    container: '[data-testid="dashboard"]',
    welcomeMessage: '[data-testid="welcome-message"]',
    groupsList: '[data-testid="groups-list"]',
    createGroupButton: 'button:has-text("Create Group")',
    addExpenseButton: 'button:has-text("Add Expense")'
  },
  groups: {
    nameInput: 'input[name="groupName"]',
    descriptionInput: 'textarea[name="groupDescription"]',
    memberEmailInput: 'input[name="memberEmail"]',
    addMemberButton: 'button:has-text("Add Member")',
    createButton: 'button:has-text("Create")',
    groupCard: '[data-testid="group-card"]',
    balanceDisplay: '[data-testid="balance-display"]'
  },
  expenses: {
    descriptionInput: 'input[name="description"]',
    amountInput: 'input[name="amount"]',
    categorySelect: 'select[name="category"]',
    paidBySelect: 'select[name="paidBy"]',
    participantCheckbox: 'input[type="checkbox"][name="participant"]',
    splitTypeRadio: 'input[type="radio"][name="splitType"]',
    saveButton: 'button:has-text("Save")',
    expenseCard: '[data-testid="expense-card"]'
  }
};

// Test result interface
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  screenshot?: string;
  error?: string;
}

// Base test class
export abstract class BrowserTestBase {
  protected results: TestResult[] = [];
  protected testName: string;

  constructor(testName: string) {
    this.testName = testName;
  }

  // Log test progress
  protected log(message: string) {
    console.log(`[${this.testName}] ${message}`);
  }

  // Record test result
  protected recordResult(name: string, passed: boolean, message: string, screenshot?: string, error?: string) {
    const result: TestResult = { name, passed, message, screenshot, error };
    this.results.push(result);
    
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
  }

  // Generate test report
  protected generateReport() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${this.testName.toUpperCase()} TEST SUMMARY`);
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${Math.round((passed/total) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   • ${r.name}: ${r.message}`);
          if (r.error) {
            console.log(`     Error: ${r.error}`);
          }
        });
    }

    const overallResult = failed === 0 ? 'PASS ✅' : 'FAIL ❌';
    console.log(`\n🎯 OVERALL RESULT: ${overallResult}`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('🚨 Some tests failed. Please review and fix issues.');
    }

    // Return exit code
    return failed === 0 ? 0 : 1;
  }

  // Abstract method - implement test logic
  abstract runTests(): Promise<number>;
}