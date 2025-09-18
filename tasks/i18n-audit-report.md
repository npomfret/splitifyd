# Internationalization (i18n) Audit Report

This report details all on-screen text found in the `webapp-v2` codebase that is not currently being read from the i18n configuration.

### App-level Components

- **App.tsx**:
  - `Loading page...`
  - `Loading...`

- **app/providers/AuthProvider.tsx**:
  - `Authentication Error`
  - `Retry`

- **components/ErrorBoundary.tsx**:
  - `errorBoundary.unexpectedError`

- **main.tsx**:
  - `Unknown Button`
  - `Link Click: `
  - `Unknown Link`
  - `Element Click: `
  - `Unknown Element`

### Auth Components

- **components/auth/AuthLayout.tsx**:
  - ` - Splitifyd`

- **components/auth/PasswordInput.tsx**:
  - `Enter your password`
  - `Password`

### Comments System

- **components/comments/CommentItem.tsx**:
  - `just now`

### Dashboard Components

- **components/dashboard/CreateGroupModal.tsx**:
  - `⚠️`

### Expense Form Components

- **components/expense-form/ExpenseFormActions.tsx**:
  - `Cancel`
  - `Updating...`
  - `Saving...`
  - `Update Expense`
  - `Save Expense`

- **components/expense-form/ParticipantSelector.tsx**:
  - `Split between`
  - `*`
  - `Select all`
  - `Select none`
  - `(Payer)`

- **components/expense-form/PayerSelector.tsx**:
  - `Who paid?`
  - `*`

- **components/expense-form/SplitAmountInputs.tsx**:
  - `Enter exact amounts for each person:`
  - `Unknown`
  - `$`
  - `Total:`
  - `Enter percentage for each person:`
  - `%`
  - `Each person pays:`

- **components/expense-form/SplitTypeSelector.tsx**:
  - `How to split`
  - `Equal`
  - `Exact amounts`
  - `Percentage`

### Expense Components

- **components/expense/ExpenseActions.tsx**:
  - `Edit`
  - `Copy`
  - `Share`
  - `Delete`
  - `Delete Expense`
  - `Are you sure you want to delete "`
  - `"? This action cannot be undone and will affect group balances.`
  - `Cancel`
  - `Failed to delete expense`

- **components/expense/SplitBreakdown.tsx**:
  - `Split between `
  - ` person`
  - ` people`
  - `Split Equally`
  - `Exact Amounts`
  - `By Percentage`
  - `Custom Split`
  - `Unknown`
  - `Paid`
  - `Owes `

### Group Components

- **components/group/GroupHeader.tsx**:
  - `ago`

- **components/group/MembersListWithManagement.tsx**:
  - `User`

- **components/group/ShareGroupModal.tsx**:
  - `Close`
  - `✓`
  - `...`

### Join Group Components

- **components/join-group/GroupPreview.tsx**:
  - `Member`
  - `Members`
  - `Active`
  - `Group`
  - `You've been invited to join this group`

- **components/join-group/JoinButton.tsx**:
  - `Joining...`
  - `Join Group`

- **components/join-group/MembersPreview.tsx**:
  - `Group Size`
  - `member`
  - `members`

### Landing Page Components

- **components/landing/CTASection.tsx**:
  - `Ready to Simplify Your Shared Expenses?`
  - `Join thousands who are already making group payments stress-free and transparent. Get started today!`
  - `Sign Up for Free`

- **components/landing/FeaturesGrid.tsx**:
  - `Smart Group Management`
  - `Create groups for any occasion. Easily add members and track shared expenses in one place, keeping everyone on the same page.`
  - `Flexible Splitting`
  - `Split bills equally, by exact amounts, or by percentages. We handle all the complex math, so you don't have to.`
  - `Debt Simplification`
  - `Our algorithm minimizes transactions, showing you the simplest way to settle up, saving everyone time and hassle.`
  - `100% Free to Use`
  - `Our service is and always will be free. No hidden fees or premium tiers—just a powerful, accessible tool for everyone.`
  - `Unlimited Use`
  - `Create as many groups, add as many friends, and track as many expenses as you need. No restrictions, no limits.`
  - `Zero Ads, Ever`
  - `Enjoy a clean, focused experience. We will never sell your data or clutter your screen with ads. Your privacy is our priority.`
  - `Everything You Need, Nothing You Don't`

- **components/landing/Globe.tsx**:
  - `Unable to load 3D globe`

- **components/landing/HeroSection.tsx**:
  - `Effortless Bill Splitting,`
  - `Simplified & Smart.`
  - `Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent.`
  - `It's 100% free, with no ads and no limits.`
  - `Focus on what matters, not on the math.`
  - `Splitifyd App Screenshot`

### Policy Components

- **components/policy/PolicyAcceptanceModal.tsx**:
  - `Accept Updated Policies`
  - `Policy `
  - ` of `
  - `: `
  - `Close`
  - `Progress`
  - ` accepted`
  - `✓ Accepted`
  - `Loading policy content...`
  - `Policy Acceptance Required`
  - `Please read the policy above and click "Accept" to continue using Splitify.`
  - `I have read and accept this `
  - `Previous`
  - `Next`
  - ` policies accepted`
  - `Accepting...`
  - `Accept All & Continue`
  - `Error`

- **components/policy/PolicyRenderer.tsx**:
  - `• `

### UI Components

- **components/ui/Alert.tsx**:
  - `Dismiss alert`

- **components/ui/Avatar.tsx**:
  - `Unknown`

- **components/ui/Button.tsx**:
  - `Button`

- **components/ui/CategorySuggestionInput.tsx**:
  - `*`
  - `Enter category...`

- **components/ui/ConfirmDialog.tsx**:
  - `Confirm`
  - `Cancel`

- **components/ui/CurrencyAmountInput.tsx**:
  - `0.00`
  - `Select currency`
  - `Search by symbol, code, or country...`
  - `Loading currencies...`
  - `No currencies found`
  - `Recent`
  - `Common`
  - `All Currencies`
  - `*`

- **components/ui/CurrencySelector.tsx**:
  - `Select currency...`
  - `Search currencies`
  - `Loading currencies...`
  - `No currencies found`
  - `Recent`
  - `Common`
  - `All Currencies`
  - `*`

- **components/ui/Input.tsx**:
  - `*`

- **components/ui/LoadingSpinner.tsx**:
  - `Loading...`

- **components/ui/RealTimeIndicator.tsx**:
  - `Network: Connected (Green)`
  - `Network: Offline (Red)`
  - `Server: Unknown - offline (Gray)`
  - `Server: Connected (Green)`
  - `Server: Poor connection (Yellow)`
  - `Server: Unavailable (Red)`
  - `Server: Unknown (Gray)`

- **components/ui/TimeInput.tsx**:
  - `at `
  - `Enter time (e.g., 2:30pm)`
  - `*`

- **components/ui/UserIndicator.tsx**:
  - `Unknown`
  - `+`
  - ` more users`

### Pages

- **pages/AddExpensePage.tsx**:
  - `Error - Splitifyd`
  - `Error`
  - `No group specified. Cannot add expense without a group.`
  - `Back to Dashboard`
  - `Loading... - Splitifyd`
  - `Group Not Found`
  - `The group you're trying to add an expense to doesn't exist or you don't have access to it.`
  - `Back to Group`
  - `Copy Expense`
  - `Edit Expense`
  - `Add Expense`
  - `Copy expense`
  - `Edit expense`
  - `Add a new expense`
  - ` - Splitifyd`
  - ` in `

- **pages/ExpenseDetailPage.tsx**:
  - `Missing group ID`
  - `Missing expense ID`
  - `Failed to load expense`
  - `Expense: `
  - `Check out this expense: `
  - `Error`
  - `Expense not found`
  - `Back to Group`
  - ` - `
  - `← Back`
  - `Date`
  - ` ago)`
  - `Category`
  - `Paid by`
  - `Unknown`
  - `Discussion`
  - `Receipt`
  - `Click to view full size`
  - `Added `
  - `Last updated `
  - `Receipt viewer`
  - `Close receipt viewer`
  - `Receipt - Full Size`

- **pages/GroupDetailPage.tsx**:
  - `Error Loading Group`
  - `Back to Dashboard`
  - `Comments`
  - `Payment History`
  - `Hide History`
  - `Show History`
  - ` - Splitifyd`
  - `Manage expenses for `

- **pages/LandingPage.tsx**:
  - `Effortless Bill Splitting - Splitifyd`
  - `Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent. It's 100% free, with no ads and no limits.`
  - `This is a tool for tracking expenses, not for making payments.`
  - ` To save and manage your expenses, you'll need a free account.`
  - `We will never ask for sensitive financial details.`

- **pages/RegisterPage.tsx**:
  - `*`

- **pages/ResetPasswordPage.tsx**:
  - `Failed to send reset email`
  - `Check Your Email`
  - `Password reset instructions have been sent to your email`
  - `Email Sent Successfully`
  - `We've sent password reset instructions to:`
  - `What's next?`
  - `• Check your email inbox (and spam folder)`
  - `• Click the reset link in the email`
  - `• Create a new password`
  - `• Sign in with your new password`
  - `Send to Different Email`
  - `← Back to Sign In`
  - `Reset Password`
  - `Enter your email address to receive password reset instructions`
  - `Enter the email address associated with your account and we'll send you a link to reset your password.`
  - `Send Reset Instructions`

- **pages/SettingsPage.tsx**:
  - ` - Splitifyd`

- **pages/static/CookiePolicyPage.tsx**:
  - `Cookie Policy`
  - `Cookie Policy for Splitifyd - Learn about how we use cookies and similar technologies.`
  - `Last updated: `
  - `January 22, 2025`
  - `Error loading cookie policy`

- **pages/static/PricingPage.tsx**:
  - `Pricing (It's Free, Seriously)`
  - `Simple, transparent pricing for Splitifyd. Split bills with friends for free.`
  - `Choose Your Adventure`
  - `The "Just Getting Started" Plan`
  - `$`
  - `0`
  - `/month`
  - `Unlimited expense tracking`
  - `Unlimited groups`
  - `Unlimited friends (if you have that many)`
  - `Basic debt simplification`
  - `Access to our highly sarcastic FAQ section`
  - `Sign Up (It's Still Free)`
  - `MOST POPULAR`
  - `The "I'm Basically a Pro" Plan`
  - `Everything in "Just Getting Started"`
  - `Advanced debt simplification (it's the same, but sounds cooler)`
  - `Priority access to our "we'll get to it when we get to it" support`
  - `The warm fuzzy feeling of not paying for anything`
  - `Bragging rights to your friends about your free app`
  - `Join Now (Seriously, No Catch)`
  - `The "I'm a Philanthropist" Plan`
  - `Everything in "I'm Basically a Pro"`
  - `The ability to tell people you're on the "Philanthropist" plan`
  - `A deep sense of satisfaction from using a free app`
  - `We'll send you good vibes (results may vary)`
  - `Your name will be whispered in the halls of free software fame`
  - `Get Started (It's a Gift!)`
  - `Disclaimer:`
  - ` All plans are, and always will be, absolutely free. We just like making fancy tables. No hidden fees, no premium features, no secret handshake
                        required. Just pure, unadulterated free expense splitting. You're welcome.`

- **pages/static/PrivacyPolicyPage.tsx**:
  - `Privacy Policy`
  - `Privacy Policy for Splitifyd - Learn about how we collect, use, and protect your information.`
  - `Last updated: `
  - `January 22, 2025`
  - `Error loading privacy policy`

- **pages/static/TermsOfServicePage.tsx**:
  - `Terms of Service`
  - `Terms of Service for Splitifyd - Read about our policies and user agreements.`
  - `Last updated: `
  - `January 22, 2025`
  - `Error loading terms`