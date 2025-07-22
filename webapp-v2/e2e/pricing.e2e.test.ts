import { test, expect } from '@playwright/test';

// E2E tests for pricing page functionality
test.describe('Pricing Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should display pricing plans clearly', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByText('Simple, Transparent Pricing')).toBeVisible();
    
    // Free plan
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(page.getByText('$0')).toBeVisible();
    await expect(page.getByText('Perfect for personal use')).toBeVisible();
    
    // Premium plan
    await expect(page.getByRole('heading', { name: 'Premium' })).toBeVisible();
    await expect(page.getByText('$5')).toBeVisible();
    await expect(page.getByText('Coming Soon')).toBeVisible();
  });

  test('should show feature comparison clearly', async ({ page }) => {
    // Free plan features
    await expect(page.getByText('Split bills with unlimited friends')).toBeVisible();
    await expect(page.getByText('Track expenses and balances')).toBeVisible();
    await expect(page.getByText('Email notifications')).toBeVisible();
    await expect(page.getByText('Mobile-friendly interface')).toBeVisible();
    
    // Premium plan features
    await expect(page.getByText('Everything in Free')).toBeVisible();
    await expect(page.getByText('Advanced reporting')).toBeVisible();
    await expect(page.getByText('Receipt scanning')).toBeVisible();
    await expect(page.getByText('Priority support')).toBeVisible();
  });

  test('should have functional call-to-action buttons', async ({ page }) => {
    // Free plan button should be clickable
    const freeButton = page.getByRole('button', { name: 'Get Started Free' });
    await expect(freeButton).toBeVisible();
    await expect(freeButton).toBeEnabled();
    
    // Premium button should show as disabled/coming soon
    const premiumButton = page.getByRole('button', { name: 'Coming Soon' });
    await expect(premiumButton).toBeVisible();
    // Note: We don't test disabled state as it's handled by CSS classes
  });

  test('should display FAQ section with helpful information', async ({ page }) => {
    await expect(page.getByText('Frequently Asked Questions')).toBeVisible();
    
    // Check key FAQ items
    await expect(page.getByText('Is Splitifyd really free?')).toBeVisible();
    await expect(page.getByText('How do you make money?')).toBeVisible();
    await expect(page.getByText('Can I use Splitifyd for large groups?')).toBeVisible();
    
    // Check that answers are provided
    await expect(page.getByText(/Yes! All core features for splitting bills/)).toBeVisible();
  });

  test('should have effective call-to-action at bottom', async ({ page }) => {
    await expect(page.getByText('Ready to Split Bills Fairly?')).toBeVisible();
    await expect(page.getByText(/Join thousands of users who trust Splitifyd/)).toBeVisible();
    
    const ctaButton = page.getByRole('link', { name: 'Start Splitting Bills' });
    await expect(ctaButton).toBeVisible();
    
    // Test CTA button functionality
    await ctaButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome to Splitifyd v2' })).toBeVisible();
  });

  test('should be mobile responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Key elements should still be visible on mobile
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Premium' })).toBeVisible();
    
    // Buttons should be accessible on mobile
    await expect(page.getByRole('button', { name: 'Get Started Free' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Coming Soon' })).toBeVisible();
  });
});