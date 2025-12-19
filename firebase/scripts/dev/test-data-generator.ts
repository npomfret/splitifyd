import type { Amount, CreateSettlementRequest, CurrencyISOCode, ExpenseDTO, GroupDTO } from '@billsplit-wl/shared';
import { AuthenticatedFirebaseUser, ExpenseLabel, toAmount, toCurrencyISOCode, toDisplayName, toEmail, toExpenseLabel, toGroupName, toUserId, UserRegistration } from '@billsplit-wl/shared';
import { ApiDriver, CreateExpenseRequestBuilder, DEFAULT_ADMIN_DISPLAY_NAME, DEFAULT_ADMIN_EMAIL, DEFAULT_PASSWORD, getFirebaseEmulatorSigninUrl } from '@billsplit-wl/test-support';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    groupCount: 10,
    membersPerGroup: { min: 2, max: 5 }, // Including creator
    actionsPerGroup: { min: 20, max: 40 },
    currenciesPerGroup: { min: 1, max: 3 },
    // Action probabilities (should sum to ~1.0)
    actionWeights: {
        createExpense: 0.55,
        editExpense: 0.08,
        deleteExpense: 0.02,
        createSettlement: 0.10,
        addExpenseComment: 0.12,
        addGroupComment: 0.13,
    },
};

// Common currencies for test data
const CURRENCIES: CurrencyISOCode[] = [
    toCurrencyISOCode('USD'),
    toCurrencyISOCode('EUR'),
    toCurrencyISOCode('GBP'),
    toCurrencyISOCode('CAD'),
    toCurrencyISOCode('AUD'),
    toCurrencyISOCode('JPY'),
    toCurrencyISOCode('CHF'),
];

// Named test users - sci-fi characters
const TEST_USERS: UserRegistration[] = [
    {
        email: toEmail('luke.skywalker@example.com'),
        displayName: toDisplayName('Luke Skywalker'),
        password: DEFAULT_PASSWORD,
        termsAccepted: true,
        cookiePolicyAccepted: true,
        privacyPolicyAccepted: true,
        signupHostname: 'localhost',
        adminEmailsAccepted: true,
        marketingEmailsAccepted: false,
    },
    { email: toEmail('leia.organa@example.com'), displayName: toDisplayName('Leia Organa'), password: DEFAULT_PASSWORD, termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true, signupHostname: 'localhost', adminEmailsAccepted: true, marketingEmailsAccepted: false },
    { email: toEmail('han.solo@example.com'), displayName: toDisplayName('Han Solo'), password: DEFAULT_PASSWORD, termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true, signupHostname: 'localhost', adminEmailsAccepted: true, marketingEmailsAccepted: false },
    {
        email: toEmail('rey.skywalker@example.com'),
        displayName: toDisplayName('Rey Skywalker'),
        password: DEFAULT_PASSWORD,
        termsAccepted: true,
        cookiePolicyAccepted: true,
        privacyPolicyAccepted: true,
        signupHostname: 'localhost',
        adminEmailsAccepted: true,
        marketingEmailsAccepted: false,
    },
    { email: toEmail('finn@example.com'), displayName: toDisplayName('Finn'), password: DEFAULT_PASSWORD, termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true, signupHostname: 'localhost', adminEmailsAccepted: true, marketingEmailsAccepted: false },
    { email: toEmail('poe.dameron@example.com'), displayName: toDisplayName('Poe Dameron'), password: DEFAULT_PASSWORD, termsAccepted: true, cookiePolicyAccepted: true, privacyPolicyAccepted: true, signupHostname: 'localhost', adminEmailsAccepted: true, marketingEmailsAccepted: false },
    {
        email: toEmail('obiwan.kenobi@example.com'),
        displayName: toDisplayName('Obi-Wan Kenobi'),
        password: DEFAULT_PASSWORD,
        termsAccepted: true,
        cookiePolicyAccepted: true,
        privacyPolicyAccepted: true,
        signupHostname: 'localhost',
        adminEmailsAccepted: true,
        marketingEmailsAccepted: false,
    },
    {
        email: toEmail('padme.amidala@example.com'),
        displayName: toDisplayName('Padmé Amidala'),
        password: DEFAULT_PASSWORD,
        signupHostname: 'localhost',
        termsAccepted: true,
        cookiePolicyAccepted: true,
        privacyPolicyAccepted: true,
        adminEmailsAccepted: true,
        marketingEmailsAccepted: false,
    },
];

const GROUP_NAMES = [
    'Weekend Trip',
    'Roommates',
    'Lunch Crew',
    'Game Night',
    'Beach House',
    'Ski Trip',
    'Birthday Party',
    'Road Trip',
    'Concert Tickets',
    'Dinner Club',
    'Movie Night',
    'Camping Trip',
    'Holiday Cabin',
    'City Break',
    'BBQ Squad',
];

const EXPENSE_LABELS: ExpenseLabel[] = [
    'food',
    'transport',
    'entertainment',
    'utilities',
    'shopping',
    'groceries',
    'rent',
    'travel',
    'drinks',
    'tickets',
]
    .map(toExpenseLabel);

const EXPENSE_DESCRIPTIONS = [
    'Groceries',
    'Uber ride',
    'Pizza',
    'Gas',
    'Movie tickets',
    'Coffee',
    'Lunch',
    'Dinner',
    'Snacks',
    'Parking',
    'Bus fare',
    'Train tickets',
    'Beer',
    'Wine',
    'Dessert',
    'Breakfast',
    'Ice cream',
    'Supplies',
];

const EXPENSE_COMMENT_TEXTS = [
    'Thanks!',
    'Got it',
    '👍',
    'Will pay soon',
    'Can we split this differently?',
    'Oops, forgot my wallet',
    'Added the tip',
    'This was expensive!',
    'Great meal',
    'Worth it',
    'Next time I pay',
];

const GROUP_COMMENT_TEXTS = [
    'Hey everyone!',
    'When are we meeting?',
    'Can someone add the hotel cost?',
    'Don\'t forget to add your expenses',
    'Great trip!',
    'Thanks for organizing',
    'Who paid for the taxi?',
    'Let\'s settle up soon',
    'Fun times! 🎉',
    'Missing anyone?',
    'Should we split the Airbnb equally?',
    'I\'ll add the groceries later',
    'Everyone good with this?',
    '❤️',
    '😂 that was hilarious',
];

// ============================================================================
// Utilities
// ============================================================================

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomAmount = (): Amount => toAmount(`${randomInt(5, 150)}.${randomInt(0, 99).toString().padStart(2, '0')}`);

const shuffled = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

// ============================================================================
// API Driver
// ============================================================================

let _driver: ApiDriver | null = null;

async function getDriver(): Promise<ApiDriver> {
    if (!_driver) {
        _driver = await ApiDriver.create();
    }
    return _driver;
}

// ============================================================================
// User Management
// ============================================================================

const BILL_SPLITTER_REGISTRATION: UserRegistration = {
    email: DEFAULT_ADMIN_EMAIL,
    password: DEFAULT_PASSWORD,
    displayName: DEFAULT_ADMIN_DISPLAY_NAME,
    termsAccepted: true,
    cookiePolicyAccepted: true,
    privacyPolicyAccepted: true,
    signupHostname: 'localhost',
    adminEmailsAccepted: true,
    marketingEmailsAccepted: false,
};

async function signInExistingUser(email: string, password: string): Promise<AuthenticatedFirebaseUser | null> {
    const signInUrl = await getFirebaseEmulatorSigninUrl();

    const response = await fetch(signInUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const errorMessage = (errorPayload as { error?: { message?: string; }; }).error?.message ?? '';
        if (errorMessage.includes('EMAIL_NOT_FOUND')) {
            return null;
        }
        if (errorMessage.includes('INVALID_PASSWORD')) {
            throw new Error(`Invalid password for ${email}`);
        }
        throw new Error(`Failed to sign in ${email}: ${errorMessage}`);
    }

    const signInData = (await response.json()) as { idToken?: string; };
    const idToken = signInData.idToken;
    if (!idToken) {
        throw new Error('Sign-in response was missing an ID token');
    }

    const tokenParts = idToken.split('.');
    const payloadSegment = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(Buffer.from(payloadSegment, 'base64').toString('utf8')) as {
        user_id?: string;
        name?: string;
    };

    return {
        uid: toUserId(decodedPayload.user_id!),
        token: idToken,
        displayName: toDisplayName(decodedPayload.name ?? email.split('@')[0]),
    };
}

async function ensureUserExists(registration: UserRegistration): Promise<AuthenticatedFirebaseUser> {
    // Try to sign in first
    const existing = await signInExistingUser(registration.email, registration.password);
    if (existing) {
        return existing;
    }

    // Create new user
    const driver = await getDriver();
    return await driver.createUser(registration);
}

async function ensureBillSplitterAdmin(): Promise<AuthenticatedFirebaseUser> {
    console.log('👤 Ensuring Bill Splitter admin exists...');
    const user = await ensureUserExists(BILL_SPLITTER_REGISTRATION);

    const driver = await getDriver();
    try {
        await driver.promoteUserToAdmin(user.uid);
    } catch {
        // Already admin, ignore
    }

    console.log(`   ✓ Bill Splitter ready (${user.displayName})`);
    return user;
}

async function ensureTestUsersExist(): Promise<AuthenticatedFirebaseUser[]> {
    console.log(`👥 Ensuring ${TEST_USERS.length} test users exist...`);
    const users: AuthenticatedFirebaseUser[] = [];

    for (const registration of TEST_USERS) {
        const user = await ensureUserExists(registration);
        users.push(user);
        console.log(`   ✓ ${user.displayName}`);
    }

    return users;
}

// ============================================================================
// Group Activity Simulation
// ============================================================================

interface GroupContext {
    group: GroupDTO;
    members: AuthenticatedFirebaseUser[];
    expenses: ExpenseDTO[];
    currencies: CurrencyISOCode[];
}

async function createGroup(
    name: string,
    creator: AuthenticatedFirebaseUser,
    otherMembers: AuthenticatedFirebaseUser[],
): Promise<GroupContext> {
    const driver = await getDriver();

    // Pick 1-3 currencies for this group
    const currencyCount = randomInt(CONFIG.currenciesPerGroup.min, CONFIG.currenciesPerGroup.max);
    const currencies = shuffled(CURRENCIES).slice(0, currencyCount);

    // Create the group
    const group = await driver.createGroup(
        {
            name: toGroupName(name),
            groupDisplayName: creator.displayName,
            description: `Test group: ${name}`,
        },
        creator.token,
    );

    // Generate invite link and have others join
    const shareLink = await driver.generateShareableLink(group.id, undefined, creator.token);

    for (const member of otherMembers) {
        try {
            await driver.joinGroupByLink(shareLink.shareToken, member.displayName, member.token);
        } catch (error: unknown) {
            // Ignore if already a member
            if (!isAlreadyMemberError(error)) {
                throw error;
            }
        }
    }

    return {
        group,
        members: [creator, ...otherMembers],
        expenses: [],
        currencies,
    };
}

function isAlreadyMemberError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const response = (error as { response?: { error?: { code?: string; detail?: string; }; }; }).response;
    return (
        (response?.error?.code === 'ALREADY_EXISTS' && response?.error?.detail === 'ALREADY_MEMBER')
        || error.message.includes('ALREADY_MEMBER')
    );
}

type ActionType = 'createExpense' | 'editExpense' | 'deleteExpense' | 'createSettlement' | 'addExpenseComment' | 'addGroupComment';

function pickAction(hasExpenses: boolean): ActionType {
    const weights = { ...CONFIG.actionWeights };

    // Can't edit/delete/comment on expenses if no expenses
    if (!hasExpenses) {
        weights.editExpense = 0;
        weights.deleteExpense = 0;
        weights.addExpenseComment = 0;
    }

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (const [action, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            return action as ActionType;
        }
    }

    return 'createExpense';
}

async function simulateGroupActivity(ctx: GroupContext): Promise<void> {
    const driver = await getDriver();
    const actionCount = randomInt(CONFIG.actionsPerGroup.min, CONFIG.actionsPerGroup.max);

    for (let i = 0; i < actionCount; i++) {
        const actor = randomChoice(ctx.members);
        const action = pickAction(ctx.expenses.length > 0);
        const currency = randomChoice(ctx.currencies);

        try {
            switch (action) {
                case 'createExpense': {
                    // paidBy must be a group member, and the actor must be a member too
                    const paidBy = randomChoice(ctx.members);
                    // splitWith must only include group members, at least 1
                    const splitCount = randomInt(1, ctx.members.length);
                    const splitWith = shuffled(ctx.members).slice(0, splitCount);

                    const expense = await driver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(ctx.group.id)
                            .withAmount(randomAmount(), currency)
                            .withDescription(randomChoice(EXPENSE_DESCRIPTIONS))
                            .withPaidBy(paidBy.uid)
                            .withParticipants(splitWith.map((m) => m.uid))
                            .withSplitType('equal')
                            .withLabels([randomChoice(EXPENSE_LABELS)])
                            .build(),
                        actor.token,
                    );
                    ctx.expenses.push(expense);
                    console.log(`      💵 ${actor.displayName} created expense: ${expense.description} (${currency})`);
                    break;
                }

                case 'editExpense': {
                    const expense = randomChoice(ctx.expenses);
                    const newAmount = randomAmount();
                    await driver.updateExpense(
                        expense.id,
                        { amount: newAmount, description: randomChoice(EXPENSE_DESCRIPTIONS) },
                        actor.token,
                    );
                    console.log(`      ✏️  ${actor.displayName} edited expense`);
                    break;
                }

                case 'deleteExpense': {
                    const expenseIndex = Math.floor(Math.random() * ctx.expenses.length);
                    const expense = ctx.expenses[expenseIndex];
                    await driver.deleteExpense(expense.id, actor.token);
                    ctx.expenses.splice(expenseIndex, 1);
                    console.log(`      🗑️  ${actor.displayName} deleted expense`);
                    break;
                }

                case 'createSettlement': {
                    // Need at least 2 members for a settlement
                    if (ctx.members.length < 2) break;

                    // Pick two different members from the group
                    const shuffledMembers = shuffled(ctx.members);
                    const payer = shuffledMembers[0];
                    const payee = shuffledMembers[1];

                    const settlementData: CreateSettlementRequest = {
                        groupId: ctx.group.id,
                        payerId: payer.uid,
                        payeeId: payee.uid,
                        amount: toAmount(`${randomInt(5, 50)}.00`),
                        currency,
                    };

                    await driver.createSettlement(settlementData, actor.token);
                    console.log(`      💸 ${actor.displayName} recorded settlement: ${payer.displayName} → ${payee.displayName} (${currency})`);
                    break;
                }

                case 'addExpenseComment': {
                    const expense = randomChoice(ctx.expenses);
                    await driver.createExpenseComment(expense.id, randomChoice(EXPENSE_COMMENT_TEXTS), undefined, actor.token);
                    console.log(`      💬 ${actor.displayName} commented on expense`);
                    break;
                }

                case 'addGroupComment': {
                    await driver.createGroupComment(ctx.group.id, randomChoice(GROUP_COMMENT_TEXTS), undefined, actor.token);
                    console.log(`      💬 ${actor.displayName} added group comment`);
                    break;
                }
            }
        } catch (error) {
            // Log but continue - some actions may fail due to permissions
            console.log(`      ⚠️  Action failed: ${(error as Error).message?.slice(0, 60)}...`);
        }
    }
}

// ============================================================================
// Main Generator
// ============================================================================

export async function generateFullTestData(): Promise<void> {
    console.log('🚀 Starting test data generation\n');
    const startTime = Date.now();

    // Step 1: Ensure all users exist
    const billSplitter = await ensureBillSplitterAdmin();
    const testUsers = await ensureTestUsersExist();
    const allUsers = [billSplitter, ...testUsers];

    console.log(`\n📊 Creating ${CONFIG.groupCount} groups with natural activity...\n`);

    // Step 2: Create groups one by one with natural activity
    for (let i = 0; i < CONFIG.groupCount; i++) {
        const groupName = GROUP_NAMES[i % GROUP_NAMES.length];

        // Pick a random creator (always include Bill Splitter as a member)
        const creator = randomChoice(allUsers);

        // Pick 1-4 other random members (ensuring Bill Splitter is included)
        const otherCount = randomInt(CONFIG.membersPerGroup.min - 1, CONFIG.membersPerGroup.max - 1);
        const availableOthers = allUsers.filter((u) => u.uid !== creator.uid);
        let others = shuffled(availableOthers).slice(0, otherCount);

        // Ensure Bill Splitter is in the group
        if (creator.uid !== billSplitter.uid && !others.some((u) => u.uid === billSplitter.uid)) {
            others = [billSplitter, ...others.slice(0, otherCount - 1)];
        }

        console.log(`\n📁 Group ${i + 1}/${CONFIG.groupCount}: "${groupName}"`);
        console.log(`   Creator: ${creator.displayName}`);
        console.log(`   Members: ${others.map((u) => u.displayName).join(', ')}`);

        const ctx = await createGroup(groupName, creator, others);
        console.log(`   ✓ Group created (currencies: ${ctx.currencies.join(', ')})`);

        // Simulate activity
        console.log(`   Simulating activity...`);
        await simulateGroupActivity(ctx);
        console.log(`   ✓ ${ctx.expenses.length} expenses in group`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Test data generation complete in ${elapsed}s`);
}

// ============================================================================
// Tenant & Theme Utilities (used by start-with-data.ts)
// ============================================================================

/**
 * Sync all demo tenant configurations from JSON files to Firestore.
 * Skips theme publishing (call publishDemoThemes separately).
 */
export async function syncDemoTenants(): Promise<void> {
    console.log('🏢 Syncing all demo tenants from JSON configuration...');

    const { syncLocalTenantConfigs } = await import('../sync-tenant-configs');
    await syncLocalTenantConfigs({ skipThemePublish: true });
}

/**
 * Publish theme CSS artifacts for all demo tenants.
 * This requires the storage bucket to be set up first.
 */
export async function publishDemoThemes(): Promise<void> {
    console.log('🎨 Publishing theme CSS artifacts for all tenants...');
    const { syncLocalTenantConfigs } = await import('../sync-tenant-configs');
    await syncLocalTenantConfigs();
}
