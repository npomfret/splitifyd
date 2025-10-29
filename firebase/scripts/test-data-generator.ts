import type { Amount, CreateSettlementRequest, GroupDTO, GroupId, GroupMember, GroupPermissions, UpdateExpenseRequest, UpdateSettlementRequest } from '@splitifyd/shared';
import {
    AuthenticatedFirebaseUser,
    compareAmounts,
    isZeroAmount,
    MemberRoles,
    minAmount,
    normalizeAmount,
    PermissionLevels,
    PREDEFINED_EXPENSE_CATEGORIES,
    subtractAmounts,
    toISOString,
    UserRegistration,
    zeroAmount,
} from '@splitifyd/shared';
import { ApiDriver, CreateExpenseRequestBuilder } from '@splitifyd/test-support';

// Initialize ApiDriver which handles all configuration
const driver = new ApiDriver();

const randomInt = (min: number, max: number): number => {
    if (max < min) {
        throw new Error(`Invalid range for randomInt: min (${min}) must be <= max (${max})`);
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

class TaskQueue {
    private running = 0;
    private readonly waiting: Array<{
        task: () => Promise<unknown>;
        resolve: (value: unknown) => void;
        reject: (error: unknown) => void;
    }> = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly limit: number) {}

    enqueue<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.waiting.push({
                task,
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            this.ensureReporting();
            this.process();
        });
    }

    private process(): void {
        if (this.running >= this.limit) {
            return;
        }

        const next = this.waiting.shift();
        if (!next) {
            return;
        }

        this.running++;
        next
            .task()
            .then((result) => {
                this.running--;
                next.resolve(result);
                this.cleanupIfIdle();
                this.process();
            })
            .catch((error) => {
                this.running--;
                next.reject(error);
                this.cleanupIfIdle();
                this.process();
            });
    }

    private ensureReporting(): void {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            if (this.running > 0 || this.waiting.length > 0) {
                console.log(`🔄 Task queue status: running=${this.running}, waiting=${this.waiting.length}`);
            } else {
                this.stopReporting();
            }
        }, 5000);
    }

    private cleanupIfIdle(): void {
        if (this.running === 0 && this.waiting.length === 0) {
            this.stopReporting();
        }
    }

    private stopReporting(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

const queue = new TaskQueue(2);
const runQueued = <T>(task: () => Promise<T>): Promise<T> => queue.enqueue(task);

const BILL_SPLITTER_REGISTRATION: UserRegistration = {
    email: 'test1@test.com',
    password: 'passwordpass',
    displayName: 'Bill Splitter',
    termsAccepted: true,
    cookiePolicyAccepted: true,
};

// Simple expense template for test data generation
interface TestExpenseTemplate {
    description: string;
    amount: Amount;
    category: string;
}

// Group with invite link for test setup
interface GroupWithInvite extends GroupDTO {
    inviteLink: string;
    memberDetails?: GroupMember[];
}

interface TestDataConfig {
    userCount: number;
    groupCount: number;
    regularExpensesPerUser: { min: number; max: number; };
    largeGroupExpenseCount: number;
    largeGroupGroupComments: { min: number; max: number; };
    largeGroupExpenseCommentsPerExpense: { min: number; max: number; };
    mode: 'fast' | 'full';
}

// Configuration presets
const TEST_CONFIGS: Record<string, TestDataConfig> = {
    fast: {
        userCount: 3,
        groupCount: 5,
        regularExpensesPerUser: { min: 1, max: 1 },
        largeGroupExpenseCount: 25,
        largeGroupGroupComments: { min: 15, max: 20 },
        largeGroupExpenseCommentsPerExpense: { min: 0, max: 2 },
        mode: 'fast',
    },
    full: {
        userCount: 21,
        groupCount: 10,
        regularExpensesPerUser: { min: 1, max: 2 },
        largeGroupExpenseCount: 60,
        largeGroupGroupComments: { min: 30, max: 45 },
        largeGroupExpenseCommentsPerExpense: { min: 0, max: 3 },
        mode: 'full',
    },
};

// Get configuration from environment or default to 'full'
const getTestConfig = (): TestDataConfig => {
    const mode = (process.env.TEST_DATA_MODE as 'fast' | 'full') || 'full';
    return TEST_CONFIGS[mode];
};

const generateTestUserRegistrations = (config: TestDataConfig): UserRegistration[] => {
    const users: UserRegistration[] = [];

    // Keep test1@test.com as the first user for easy reference
    users.push({ ...BILL_SPLITTER_REGISTRATION });

    // More realistic test users with @example.com emails - Sci-Fi characters
    const testUsers = [
        { email: 'luke.skywalker@example.com', displayName: 'Luke Skywalker' },
        { email: 'leia.organa@example.com', displayName: 'Leia Organa' },
        { email: 'han.solo@example.com', displayName: 'Han Solo' },
        { email: 'rey.skywalker@example.com', displayName: 'Rey Skywalker' },
        { email: 'finn@example.com', displayName: 'Finn' },
        { email: 'poe.dameron@example.com', displayName: 'Poe Dameron' },
        { email: 'obiwan.kenobi@example.com', displayName: 'Obi-Wan Kenobi' },
        { email: 'padme.amidala@example.com', displayName: 'Padme Amidala' },
        { email: 'ahsoka.tano@example.com', displayName: 'Ahsoka Tano' },
        { email: 'anakin.skywalker@example.com', displayName: 'Anakin Skywalker' },
        { email: 'james.kirk@example.com', displayName: 'James T. Kirk' },
        { email: 'spock@example.com', displayName: 'Spock' },
        { email: 'jeanluc.picard@example.com', displayName: 'Jean-Luc Picard' },
        { email: 'nyota.uhura@example.com', displayName: 'Nyota Uhura' },
        { email: 'hikaru.sulu@example.com', displayName: 'Hikaru Sulu' },
        { email: 'montgomery.scott@example.com', displayName: 'Montgomery Scott' },
        { email: 'ellen.ripley@example.com', displayName: 'Ellen Ripley' },
        { email: 'sarah.connor@example.com', displayName: 'Sarah Connor' },
        { email: 'dana.scully@example.com', displayName: 'Dana Scully' },
        { email: 'fox.mulder@example.com', displayName: 'Fox Mulder' },
        { email: 'paul.atreides@example.com', displayName: 'Paul Atreides' },
        { email: 'chani@example.com', displayName: 'Chani' },
        { email: 'leto.atreides@example.com', displayName: 'Leto Atreides' },
        { email: 'jessica@example.com', displayName: 'Lady Jessica' },
        { email: 'gurney.halleck@example.com', displayName: 'Gurney Halleck' },
        { email: 'deckard@example.com', displayName: 'Rick Deckard' },
        { email: 'trinity@example.com', displayName: 'Trinity' },
        { email: 'neo@example.com', displayName: 'Neo' },
        { email: 'morpheus@example.com', displayName: 'Morpheus' },
        { email: 'arthur.dent@example.com', displayName: 'Arthur Dent' },
        { email: 'ford.prefect@example.com', displayName: 'Ford Prefect' },
        { email: 'mal.reynolds@example.com', displayName: 'Malcolm Reynolds' },
        { email: 'river.tam@example.com', displayName: 'River Tam' },
        { email: 'simon.tam@example.com', displayName: 'Simon Tam' },
        { email: 'zoe.washburne@example.com', displayName: 'Zoe Washburne' },
    ];

    // Add users based on config count (minus 1 since we already have test1@test.com)
    const remainingCount = Math.min(config.userCount - 1, testUsers.length);
    for (let i = 0; i < remainingCount; i++) {
        users.push({
            ...testUsers[i],
            termsAccepted: true,
            cookiePolicyAccepted: true,
            password: 'passwordpass',
        });
    }

    return users;
};

export async function generateBillSplitterUser(): Promise<AuthenticatedFirebaseUser> {
    console.log('👤 Ensuring Bill Splitter test user exists...');
    const user = await runQueued(() => driver.createUser({ ...BILL_SPLITTER_REGISTRATION }));
    console.log('👑 Promoting Bill Splitter to system admin...');
    await runQueued(() => driver.promoteUserToAdmin(user.token));
    console.log(`✓ Bill Splitter user ready as admin (${user.displayName})`);
    return user;
}

// Extract category names from the real predefined categories
const EXPENSE_CATEGORIES = PREDEFINED_EXPENSE_CATEGORIES.map((cat) => cat.name);
// Diverse expense descriptions that work with various categories
const EXPENSE_DESCRIPTIONS = [
    'Dinner at restaurant',
    'Grocery shopping',
    'Coffee run',
    'Lunch',
    'Pizza delivery',
    'Takeout',
    'Uber ride',
    'Gas for car',
    'Train ticket',
    'Parking fee',
    'Taxi ride',
    'Bus fare',
    'Movie tickets',
    'Concert',
    'Theater show',
    'Museum visit',
    'Game night',
    'Bowling',
    'Hotel booking',
    'Airbnb stay',
    'Room service',
    'Vacation rental',
    'Camping fees',
    'Electric bill',
    'Internet bill',
    'Phone bill',
    'Water bill',
    'Gym membership',
    'Clothes shopping',
    'Electronics',
    'Books',
    'Gifts',
    'Home supplies',
    'Furniture',
    'Doctor visit',
    'Pharmacy',
    'Dental checkup',
    'Prescription',
    'Therapy session',
    'Online course',
    'Textbooks',
    'School supplies',
    'Tuition',
    'Workshop',
    'Pet food',
    'Vet visit',
    'Pet grooming',
    'Pet toys',
    'Pet supplies',
    'Bar drinks',
    'Wine',
    'Beer',
    'Cocktails',
    'Happy hour',
    'Brewery tour',
    'Coffee beans',
    'Espresso machine',
    'Coffee shop visit',
    'Latte',
    'Cold brew',
    'Laptop',
    'Phone',
    'Headphones',
    'Software',
    'App subscription',
    'Cloud storage',
    'Video games',
    'Gaming console',
    'Board games',
    'Gaming accessories',
    'Garden supplies',
    'Home decor',
    'Tools',
    'Paint',
    'Cleaning supplies',
    'Netflix',
    'Spotify',
    'Disney+',
    'YouTube Premium',
    'News subscription',
    'Birthday gift',
    'Wedding gift',
    'Holiday present',
    'Thank you gift',
    'Charity donation',
    'Fundraiser',
    'Volunteering expenses',
    'Community support',
    'Art supplies',
    'Craft materials',
    'Hobby equipment',
    'Workshop materials',
    'Personal trainer',
    'Yoga class',
    'Sports equipment',
    'Marathon entry',
    'Skincare',
    'Haircut',
    'Makeup',
    'Spa day',
    'Manicure',
    'Date night',
    'Anniversary dinner',
    'Flowers',
    'Romantic getaway',
    'Counseling',
    'Self-help book',
    'Meditation app',
    'Wellness retreat',
    'Babysitting',
    'Kids toys',
    'School lunch',
    'Playground visit',
    'Night out',
    'Club entry',
    'Late night food',
    'Dancing',
    'Lottery ticket',
    'Scratch card',
    'Casino visit',
    'Betting',
    'Late night snacks',
    'Junk food',
    'Convenience store',
    'Vending machine',
    'Hangover cure',
    'Recovery drinks',
    'Aspirin',
    'Comfort food',
    'Impulse buy',
    'Random purchase',
    'Saw it and bought it',
    'Why did I buy this',
    'Business expense',
    'Work supplies',
    'Networking event',
    'Professional development',
    'Totally legal bribe',
    'Favor payment',
    'Smooth talking fee',
    'Convenience fee',
    'Legal consultation',
    'Court fees',
    'Bail money',
    'Lawyer retainer',
    'Weird Amazon find',
    'Strange gadget',
    'Quirky item',
    'Internet rabbit hole purchase',
    'Miscellaneous',
    'Random expense',
    'Other stuff',
    'Unspecified purchase',
];

const generateRandomExpense = (): TestExpenseTemplate => {
    const description = EXPENSE_DESCRIPTIONS[Math.floor(Math.random() * EXPENSE_DESCRIPTIONS.length)];
    const category = EXPENSE_CATEGORIES[Math.floor(Math.random() * EXPENSE_CATEGORIES.length)];
    // More varied amounts with realistic distribution
    const amountTypes = [
        () => Math.round((Math.random() * 15 + 3) * 100) / 100, // Micro: $3-$18 (30%)
        () => Math.round((Math.random() * 35 + 10) * 100) / 100, // Small: $10-$45 (25%)
        () => Math.round((Math.random() * 80 + 20) * 100) / 100, // Medium: $20-$100 (25%)
        () => Math.round((Math.random() * 200 + 50) * 100) / 100, // Large: $50-$250 (15%)
        () => Math.round((Math.random() * 500 + 100) * 100) / 100, // XLarge: $100-$600 (5%)
    ];
    const weights = [0.3, 0.25, 0.25, 0.15, 0.05]; // Distribution weights
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedIndex = 0;
    for (let i = 0; i < weights.length; i++) {
        cumulativeWeight += weights[i];
        if (rand <= cumulativeWeight) {
            selectedIndex = i;
            break;
        }
    }
    const amount = amountTypes[selectedIndex]().toFixed(2) as Amount;
    return { description, amount, category };
};

async function createTestPoolUsers(): Promise<void> {
    console.log('🏊 Initializing test pool users...');

    const POOL_SIZE = 10;

    // Check which pool users already exist
    const emails = [];
    for (let i = 1; i <= POOL_SIZE; i++) {
        // Try to create the user - if it already exists, Firebase will throw an error
        const user = await runQueued(() => driver.borrowTestUser());
        console.log(`Created pool user:`, user.email);
        emails.push(user.email);
    }
    for (const email of emails) {
        await runQueued(() => driver.returnTestUser(email));
    }

    console.log('✅ Test pool users ready');
}

async function createGroupWithInvite(name: string, createdBy: AuthenticatedFirebaseUser): Promise<GroupWithInvite> {
    // Create group with just the creator initially
    const group = await runQueued(() => driver.createGroupWithMembers(name, [createdBy], createdBy.token));

    // Generate shareable link
    const shareLink = await runQueued(() => driver.generateShareLink(group.id, createdBy.token));

    return {
        ...group,
        inviteLink: shareLink.linkId,
        memberDetails: undefined,
    } as GroupWithInvite;
}

async function createGroups(creators: AuthenticatedFirebaseUser[], config: TestDataConfig): Promise<GroupWithInvite[]> {
    const groups: GroupWithInvite[] = [];

    if (creators.length === 0) {
        throw new Error('At least one creator is required to generate groups');
    }

    const pickCreator = (index: number): AuthenticatedFirebaseUser => creators[index % creators.length];

    // Create special "Empty Group" with NO expenses
    const emptyGroupCreator = pickCreator(0);
    const emptyGroup = await createGroupWithInvite('Empty Group', emptyGroupCreator);
    groups.push(emptyGroup);
    console.log(`Created special empty group: ${emptyGroup.name} (creator: ${emptyGroupCreator.displayName}) with invite link: ${emptyGroup.inviteLink}`);

    // Create special "Settled Group" with multi-currency expenses and settlements
    const settledGroupCreator = pickCreator(1);
    const settledGroup = await createGroupWithInvite('Settled Group', settledGroupCreator);
    groups.push(settledGroup);
    console.log(`Created special settled group: ${settledGroup.name} (creator: ${settledGroupCreator.displayName}) with invite link: ${settledGroup.inviteLink}`);

    // Create special "Large Group" with many users and expenses
    const largeGroupCreator = pickCreator(2);
    const largeGroup = await createGroupWithInvite('Large Group', largeGroupCreator);
    groups.push(largeGroup);
    console.log(`Created special large group: ${largeGroup.name} (creator: ${largeGroupCreator.displayName}) with invite link: ${largeGroup.inviteLink}`);

    // Create regular groups with various names
    const regularGroupCount = config.groupCount - 3;
    const groupNames = [
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
    ];

    for (let i = 0; i < regularGroupCount; i++) {
        const groupName = groupNames[i % groupNames.length] + (i >= groupNames.length ? ` ${Math.floor(i / groupNames.length) + 1}` : '');
        const creator = pickCreator(i + 3);
        const group = await createGroupWithInvite(groupName, creator);
        groups.push(group);
        console.log(`Created group: ${group.name} (creator: ${creator.displayName}) with invite link: ${group.inviteLink}`);
    }

    return groups;
}

async function joinGroupsRandomly(users: AuthenticatedFirebaseUser[], groups: GroupWithInvite[]): Promise<Map<string, AuthenticatedFirebaseUser[]>> {
    // Track which users are in which groups
    const groupMemberships = new Map<string, AuthenticatedFirebaseUser[]>();

    // Initialize with the actual group creator in all groups
    const userByUid = new Map(users.map((user) => [user.uid, user] as const));
    const fallbackCreator = users[0];
    for (const group of groups) {
        const creatorUser = userByUid.get(group.createdBy) ?? fallbackCreator;
        groupMemberships.set(group.id, [creatorUser]);
    }

    // Each user (except test1 who created all groups) joins groups
    const otherUsers = users.slice(1); // Skip test1@test.com

    console.log(`Having ${otherUsers.length} users join groups`);

    // Process all users in parallel for better performance
    await Promise.all(
        otherUsers.map(async (user) => {
            let joinedCount = 0;
            const joinPromises = [];

            for (const group of groups) {
                let shouldJoin = false;

                const currentMembers = groupMemberships.get(group.id) || [];
                if (currentMembers.some((member) => member.uid === user.uid)) {
                    continue;
                }

                // Special handling for different group types
                if (group.name === 'Large Group') {
                    // Everyone joins the Large Group
                    shouldJoin = true;
                } else if (group.name === 'Empty Group') {
                    // Only 50% join the Empty Group
                    shouldJoin = Math.random() < 0.5;
                } else if (group.name === 'Settled Group') {
                    // Everyone joins the Settled Group for balanced expenses
                    shouldJoin = true;
                } else {
                    if (currentMembers.length >= 5) {
                        shouldJoin = false;
                    } else if (currentMembers.length <= 2) {
                        shouldJoin = true;
                    } else {
                        shouldJoin = Math.random() < 0.4;
                    }
                }

                if (shouldJoin) {
                    joinPromises.push(
                        runQueued(() => driver.joinGroupViaShareLink(group.inviteLink, user.token)).then(() => {
                            joinedCount++;
                            // Track membership
                            const updatedMembers = groupMemberships.get(group.id) || [];
                            updatedMembers.push(user);
                            groupMemberships.set(group.id, updatedMembers);
                        }),
                    );
                }
            }

            await Promise.all(joinPromises);
            console.log(`${user.displayName} joined ${joinedCount} out of ${groups.length} groups`);
        }),
    );

    return groupMemberships;
}

async function ensureBillSplitterInAllGroups(
    groups: GroupWithInvite[],
    billSplitterUser: AuthenticatedFirebaseUser,
    groupMemberships: Map<string, AuthenticatedFirebaseUser[]>,
): Promise<void> {
    for (const group of groups) {
        const members = group.memberDetails ?? [];
        const hasBillSplitter = members.some((member) => member.uid === billSplitterUser.uid);

        if (!hasBillSplitter) {
            await runQueued(() => driver.joinGroupViaShareLink(group.inviteLink, billSplitterUser.token));
            console.log(`Ensured Bill Splitter is a member of group: ${group.name}`);

            const refreshedDetails = await runQueued(() => driver.getGroupFullDetails(group.id, billSplitterUser.token));
            group.memberDetails = refreshedDetails.members.members;
        }

        const trackedMembers = groupMemberships.get(group.id) ?? [];
        if (!trackedMembers.some((member) => member.uid === billSplitterUser.uid)) {
            groupMemberships.set(group.id, [billSplitterUser, ...trackedMembers]);
        }
    }
}

async function configureLargeGroupAdvancedScenarios(
    groups: GroupWithInvite[],
    groupMemberships: Map<string, AuthenticatedFirebaseUser[]>,
    users: AuthenticatedFirebaseUser[],
): Promise<void> {
    const largeGroup = groups.find((group) => group.name === 'Large Group');
    if (!largeGroup) {
        console.warn('Large Group not found during advanced scenario configuration');
        return;
    }

    const trackedMembers = groupMemberships.get(largeGroup.id) ?? [];
    if (trackedMembers.length === 0) {
        console.warn('Large Group has no tracked members during advanced scenario configuration');
        return;
    }

    const adminUser = trackedMembers.find((member) => member.uid === largeGroup.createdBy) ?? trackedMembers[0];

    console.log('Configuring permissions, roles, and pending membership flows for "Large Group"...');

    await runQueued(() =>
        driver.updateGroup(largeGroup.id, {
            description: 'Large scale group used to exercise permissions, approval queues, member role changes, and other edge cases.',
        }, adminUser.token)
    );

    const customPermissions: Partial<GroupPermissions> = {
        expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
        expenseDeletion: PermissionLevels.ADMIN_ONLY,
        memberInvitation: PermissionLevels.ADMIN_ONLY,
        memberApproval: 'admin-required',
        settingsManagement: PermissionLevels.ADMIN_ONLY,
    };
    await runQueued(() => driver.updateGroupPermissions(largeGroup.id, customPermissions, adminUser.token));

    const nonCreatorMembers = trackedMembers.filter((member) => member.uid !== adminUser.uid);
    if (nonCreatorMembers.length > 0) {
        const promotedAdmin = nonCreatorMembers[0];
        await runQueued(() => driver.updateMemberRole(largeGroup.id, promotedAdmin.uid, MemberRoles.ADMIN, adminUser.token));
        console.log(`Promoted ${promotedAdmin.displayName} to admin in "Large Group"`);
    }

    type ApplicantType = 'viewer' | 'reject' | 'pending';
    const timestampSuffix = Date.now();
    const applicantDefinitions: Array<{ key: ApplicantType; registration: UserRegistration; }> = [
        {
            key: 'viewer',
            registration: {
                email: `managed.viewer+${timestampSuffix}@example.com`,
                password: 'passwordpass',
                displayName: 'Managed Viewer',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            },
        },
        {
            key: 'reject',
            registration: {
                email: `managed.reject+${timestampSuffix}@example.com`,
                password: 'passwordpass',
                displayName: 'Rejected Applicant',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            },
        },
        {
            key: 'pending',
            registration: {
                email: `managed.pending+${timestampSuffix}@example.com`,
                password: 'passwordpass',
                displayName: 'Pending Applicant',
                termsAccepted: true,
                cookiePolicyAccepted: true,
            },
        },
    ];

    const applicantUsers: Partial<Record<ApplicantType, AuthenticatedFirebaseUser>> = {};

    for (const applicant of applicantDefinitions) {
        const user = await runQueued(() => driver.createUser(applicant.registration));
        users.push(user);
        applicantUsers[applicant.key] = user;
        await runQueued(() => driver.joinGroupViaShareLink(largeGroup.inviteLink, user.token));
        console.log(`Received join request from ${user.displayName}; awaiting approval in "Large Group"`);
    }

    const pendingBefore = await runQueued(() => driver.getPendingMembers(largeGroup.id, adminUser.token));
    const pendingByUid = new Map(pendingBefore.map((member) => [member.uid, member]));

    const viewerApplicant = applicantUsers.viewer;
    if (viewerApplicant && pendingByUid.has(viewerApplicant.uid)) {
        await runQueued(() => driver.approveMember(largeGroup.id, viewerApplicant.uid, adminUser.token));
        const updatedMembers = groupMemberships.get(largeGroup.id) ?? [];
        updatedMembers.push(viewerApplicant);
        groupMemberships.set(largeGroup.id, updatedMembers);
        console.log(`Approved ${viewerApplicant.displayName} into "Large Group"`);

        await runQueued(() => driver.updateMemberRole(largeGroup.id, viewerApplicant.uid, MemberRoles.VIEWER, adminUser.token));
        await runQueued(() => driver.updateGroupMemberDisplayName(largeGroup.id, `Viewer ${viewerApplicant.displayName}`, viewerApplicant.token));
        console.log(`Set ${viewerApplicant.displayName} to viewer role with custom group display name`);
    }

    const rejectedApplicant = applicantUsers.reject;
    if (rejectedApplicant && pendingByUid.has(rejectedApplicant.uid)) {
        await runQueued(() => driver.rejectMember(largeGroup.id, rejectedApplicant.uid, adminUser.token));
        console.log(`Rejected ${rejectedApplicant.displayName} from "Large Group"`);
    }

    const pendingApplicant = applicantUsers.pending;
    if (pendingApplicant) {
        const stillPendingMembers = await runQueued(() => driver.getPendingMembers(largeGroup.id, adminUser.token));
        if (stillPendingMembers.some((member) => member.uid === pendingApplicant.uid)) {
            console.log(`Left ${pendingApplicant.displayName} pending in "Large Group" to test approval queues`);
        }
    }

    const { group: updatedGroup, members } = await runQueued(() => driver.getGroupFullDetails(largeGroup.id, adminUser.token));
    largeGroup.description = updatedGroup.description;
    largeGroup.memberDetails = members.members;

    const pendingAfter = await runQueued(() => driver.getPendingMembers(largeGroup.id, adminUser.token));
    console.log(`Large Group advanced configuration complete: ${members.members.length} active members, ${pendingAfter.length} pending members awaiting action`);
}

async function createTestExpenseTemplate(groupId: GroupId, expense: TestExpenseTemplate, participants: AuthenticatedFirebaseUser[], createdBy: AuthenticatedFirebaseUser): Promise<any> {
    const participantIds = participants.map((p) => p.uid);

    // Randomly choose between GBP and EUR
    const currency = Math.random() < 0.5 ? 'GBP' : 'EUR';
    const normalizedAmount = normalizeAmount(expense.amount, currency);

    const expenseData = new CreateExpenseRequestBuilder()
        .withGroupId(groupId)
        .withAmount(normalizedAmount, currency)
        .withDescription(expense.description)
        .withCategory(expense.category)
        .withDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())
        .withSplitType('equal')
        .withParticipants(participantIds)
        .withPaidBy(createdBy.uid)
        .build();

    // Create expense via ApiDriver
    return await runQueued(() => driver.createExpense(expenseData, createdBy.token));
}

async function createRandomExpensesForGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    // Skip the special groups - only process regular groups
    const regularGroups = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group' && g.name !== 'Large Group');

    console.log(`Creating random expenses for ${regularGroups.length} regular groups`);

    // Process groups in batches of 3 to reduce contention
    const BATCH_SIZE = 3;

    for (let i = 0; i < regularGroups.length; i += BATCH_SIZE) {
        const groupBatch = regularGroups.slice(i, i + BATCH_SIZE);

        await Promise.all(
            groupBatch.map(async (group) => {
                // Get actual members of this group from tracked memberships
                const groupMembers = groupMemberships.get(group.id) || [];

                if (groupMembers.length === 0) {
                    console.log(`No members found for group ${group.name}, skipping expense creation`);
                    return;
                }

                const totalExpenses = Math.floor(Math.random() * 5) + 3; // 3-7 expenses per group
                let createdCount = 0;

                for (let j = 0; j < totalExpenses; j++) {
                    const expense = generateRandomExpense();
                    const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];

                    // Random subset of group members participate (at least 2, including payer)
                    const minParticipants = Math.min(2, groupMembers.length);
                    const maxParticipants = Math.min(groupMembers.length, 5);
                    const participantCount = Math.floor(Math.random() * (maxParticipants - minParticipants + 1)) + minParticipants;

                    const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
                    let participants = shuffled.slice(0, participantCount);

                    // Ensure payer is always included
                    if (!participants.some((p) => p.uid === payer.uid)) {
                        participants[0] = payer;
                    }

                    await createTestExpenseTemplate(group.id, expense, participants, payer);
                    createdCount++;
                }

                console.log(`Created ${createdCount} random expenses for group: ${group.name}`);
            }),
        );
    }
}

async function createBalancedExpensesForSettledGroup(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    const settledGroup = groups.find((g) => g.name === 'Settled Group');
    if (!settledGroup) return;

    console.log('Creating balanced expenses and settlements for "Settled Group" so no one owes anything');

    // Get actual members of this group from tracked memberships
    const groupMembers = groupMemberships.get(settledGroup.id) || [];

    if (groupMembers.length < 2) return;

    console.log(`Creating balanced expenses for ${groupMembers.length} members in Settled Group`, {
        groupId: settledGroup.id,
        memberIds: groupMembers.map((m) => m.uid),
        memberNames: groupMembers.map((m) => m.displayName),
    });

    // Create various expenses in both currencies
    const expenseScenarios = [
        { description: 'Restaurant dinner', amount: '120', currency: 'GBP', category: 'food' },
        { description: 'Hotel booking', amount: '350', currency: 'EUR', category: 'accommodation' },
        { description: 'Concert tickets', amount: '180', currency: 'GBP', category: 'entertainment' },
        { description: 'Car rental', amount: '240', currency: 'EUR', category: 'transport' },
        { description: 'Grocery shopping', amount: '85', currency: 'GBP', category: 'food' },
        { description: 'Train tickets', amount: '150', currency: 'EUR', category: 'transport' },
        { description: 'Museum passes', amount: '60', currency: 'GBP', category: 'entertainment' },
        { description: 'Wine tasting tour', amount: '180', currency: 'EUR', category: 'entertainment' },
    ];

    // Create expenses with different payers and participants
    const expensePromises = [];
    for (let i = 0; i < Math.min(expenseScenarios.length, groupMembers.length * 2); i++) {
        const scenario = expenseScenarios[i % expenseScenarios.length];
        const payer = groupMembers[i % groupMembers.length];

        // Vary the participants - sometimes everyone, sometimes a subset
        let participants: AuthenticatedFirebaseUser[];
        if (i % 3 === 0) {
            // Everyone participates
            participants = [...groupMembers];
        } else {
            // Random subset (at least 2 including payer)
            const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
            const participantCount = Math.min(groupMembers.length, Math.floor(Math.random() * 3) + 2);
            participants = shuffled.slice(0, participantCount);
            if (!participants.includes(payer)) {
                participants[0] = payer;
            }
        }

        const participantIds = participants.map((p) => p.uid);
        const normalizedScenarioAmount = normalizeAmount(scenario.amount, scenario.currency);

        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(settledGroup.id)
            .withAmount(normalizedScenarioAmount, scenario.currency)
            .withDescription(scenario.description)
            .withCategory(scenario.category)
            .withDate(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())
            .withSplitType('equal')
            .withParticipants(participantIds)
            .withPaidBy(payer.uid)
            .build();

        expensePromises.push(
            runQueued(() => driver.createExpense(expenseData, payer.token)).then(() => {
                console.log(`Created expense: ${payer.displayName} paid ${scenario.currency} ${scenario.amount} for "${scenario.description}"`);
            }),
        );
    }

    // Wait for all expenses to be created
    await Promise.all(expensePromises);

    // Now fetch the actual balances from the API to see what needs settling
    console.log('Fetching current balances to calculate settlements...');

    const balancesResponse = await runQueued(() => driver.getGroupBalances(settledGroup.id, groupMembers[0].token));
    const balancesByCurrency = balancesResponse.balancesByCurrency || {};

    // Create settlements to zero out all balances
    const settlementPromises: Array<Promise<void>> = [];

    for (const currency of ['GBP', 'EUR']) {
        const currencyBalances = balancesByCurrency[currency];
        if (!currencyBalances) continue;

        const zero = zeroAmount(currency);

        const debtors: { user: AuthenticatedFirebaseUser; amount: Amount; }[] = [];
        const creditors: { user: AuthenticatedFirebaseUser; amount: Amount; }[] = [];

        for (const member of groupMembers) {
            const balance = currencyBalances[member.uid];
            if (!balance || balance.netBalance === undefined) {
                continue;
            }
            const netBalance = normalizeAmount(balance.netBalance, currency);
            const comparison = compareAmounts(netBalance, zero, currency);

            if (comparison < 0) {
                const owed = subtractAmounts(zero, netBalance, currency);
                debtors.push({ user: member, amount: owed });
            } else if (comparison > 0) {
                creditors.push({ user: member, amount: netBalance });
            }
        }

        debtors.sort((a, b) => compareAmounts(b.amount, a.amount, currency));
        creditors.sort((a, b) => compareAmounts(b.amount, a.amount, currency));

        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];

            const settlementAmount = minAmount(debtor.amount, creditor.amount, currency);

            if (!isZeroAmount(settlementAmount, currency)) {
                const settlementData: CreateSettlementRequest = {
                    groupId: settledGroup.id,
                    payerId: debtor.user.uid,
                    payeeId: creditor.user.uid,
                    amount: settlementAmount,
                    currency,
                    note: `Settling up ${currency} expenses`,
                    date: toISOString(new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString()),
                };

                settlementPromises.push(
                    runQueued(async () => {
                        try {
                            await driver.createSettlement(settlementData, debtor.user.token);
                            const symbol = currency === 'GBP' ? '£' : '€';
                            console.log(`Created settlement: ${debtor.user.displayName} → ${creditor.user.displayName} ${symbol}${settlementAmount}`);
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            throw new Error(`Failed to create settlement: ${message}`);
                        }
                    }),
                );

                debtor.amount = subtractAmounts(debtor.amount, settlementAmount, currency);
                creditor.amount = subtractAmounts(creditor.amount, settlementAmount, currency);
            }

            if (isZeroAmount(debtor.amount, currency)) {
                debtorIndex++;
            } else if (isZeroAmount(settlementAmount, currency)) {
                debtorIndex++;
            }

            if (isZeroAmount(creditor.amount, currency)) {
                creditorIndex++;
            } else if (isZeroAmount(settlementAmount, currency)) {
                creditorIndex++;
            }
        }
    }

    await Promise.all(settlementPromises);

    // Verify final balances
    const finalBalances = await runQueued(() => driver.getGroupBalances(settledGroup.id, groupMembers[0].token));

    console.log('Final balances in Settled Group (should all be ~0):');
    for (const currency of ['GBP', 'EUR']) {
        const currencyBalances = finalBalances.balancesByCurrency?.[currency];
        if (currencyBalances) {
            const zero = zeroAmount(currency);
            console.log(`  ${currency}:`);
            for (const member of groupMembers) {
                const balance = currencyBalances[member.uid];
                if (balance) {
                    const symbol = currency === 'GBP' ? '£' : '€';
                    const netBalance = normalizeAmount(balance.netBalance ?? zero, currency);
                    console.log(`    ${member.displayName}: ${symbol}${netBalance}`);
                }
            }
        }
    }

    console.log(`✓ Successfully created balanced multi-currency expenses and settlements for "Settled Group"`);
}

async function createManyExpensesForLargeGroup(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>, config: TestDataConfig): Promise<void> {
    const largeGroup = groups.find((g) => g.name === 'Large Group');
    if (!largeGroup) return;

    console.log('Creating many expenses for "Large Group" to test pagination');

    // Get actual members of this group from tracked memberships
    const groupMembers = groupMemberships.get(largeGroup.id) || [];
    const memberDetails = largeGroup.memberDetails ?? [];
    const roleByUid = new Map(memberDetails.map((member) => [member.uid, member.memberRole]));
    const eligiblePayers = groupMembers.filter((member) => roleByUid.get(member.uid) !== MemberRoles.VIEWER);
    const payerPool = eligiblePayers.length > 0 ? eligiblePayers : groupMembers;

    if (groupMembers.length === 0) return;

    // Create expenses based on config to test pagination
    const totalExpenses = config.largeGroupExpenseCount;

    for (let i = 0; i < totalExpenses; i++) {
        const expense = generateRandomExpense();
        const payer = payerPool[Math.floor(Math.random() * payerPool.length)];

        // Random participants (2-5 people)
        const participantCount = Math.floor(Math.random() * 4) + 2;
        const shuffled = [...groupMembers].sort(() => 0.5 - Math.random());
        let participants = shuffled.slice(0, Math.min(participantCount, groupMembers.length));

        // Ensure payer is included
        if (!participants.some((p) => p.uid === payer.uid)) {
            participants[0] = payer;
        }

        await createTestExpenseTemplate(largeGroup.id, expense, participants, payer);

        if ((i + 1) % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    console.log(`Created ${totalExpenses} expenses for "Large Group"`);
}

async function createManySettlementsForLargeGroup(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>, config: TestDataConfig): Promise<void> {
    const largeGroup = groups.find((g) => g.name === 'Large Group');
    if (!largeGroup) return;

    console.log('Creating many settlements for "Large Group"');

    // Get actual members of this group from tracked memberships
    const groupMembers = groupMemberships.get(largeGroup.id) || [];
    const memberDetails = largeGroup.memberDetails ?? [];
    const roleByUid = new Map(memberDetails.map((member) => [member.uid, member.memberRole]));
    const eligiblePayers = groupMembers.filter((member) => roleByUid.get(member.uid) !== MemberRoles.VIEWER);
    const payerPool = eligiblePayers.length > 0 ? eligiblePayers : groupMembers;

    if (groupMembers.length < 2) return;

    // Create settlements based on config (about 15% of expenses count, capped)
    const totalSettlements = Math.min(Math.floor(config.largeGroupExpenseCount * 0.15), 12);

    const settlementNotes = [
        'Quick settlement',
        'Paying back from last week',
        'Settling up expenses',
        'Partial payment',
        'Final settlement',
        'Monthly balance',
        'Weekend trip payback',
        'Dinner expenses paid',
        'Splitting bills',
        'Evening out accounts',
    ];

    for (let i = 0; i < totalSettlements; i++) {
        // Pick random payer and payee
        const payer = payerPool[Math.floor(Math.random() * payerPool.length)];
        const availablePayees = groupMembers.filter((m) => m.uid !== payer.uid);

        if (availablePayees.length === 0) continue;

        const payee = availablePayees[Math.floor(Math.random() * availablePayees.length)];

        // Random amount between $10 and $150
        const currency = Math.random() < 0.5 ? 'GBP' : 'EUR';
        const rawAmount = Math.random() * 140 + 10;
        const amount = normalizeAmount(rawAmount, currency);

        const settlementData: CreateSettlementRequest = {
            groupId: largeGroup.id,
            payerId: payer.uid,
            payeeId: payee.uid,
            amount: amount,
            currency: currency,
            note: settlementNotes[Math.floor(Math.random() * settlementNotes.length)],
            date: toISOString(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()),
        };

        await runQueued(() => driver.createSettlement(settlementData, payer.token));

        if ((i + 1) % 3 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    console.log(`Created ${totalSettlements} settlements for "Large Group"`);
}

async function finalizeLargeGroupAdvancedData(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    const largeGroup = groups.find((group) => group.name === 'Large Group');
    if (!largeGroup) {
        console.warn('Large Group not found when finalizing advanced scenarios');
        return;
    }

    const trackedMembers = groupMemberships.get(largeGroup.id) ?? [];
    if (trackedMembers.length === 0) {
        console.warn('Large Group has no tracked members to finalize advanced scenarios');
        return;
    }

    const adminUser = trackedMembers.find((member) => member.uid === largeGroup.createdBy) ?? trackedMembers[0];

    console.log('Applying updates, deletions, and membership departures for "Large Group"...');

    const fullDetails = await runQueued(() => driver.getGroupFullDetails(largeGroup.id, adminUser.token));
    largeGroup.memberDetails = fullDetails.members.members;

    const expensesList = fullDetails.expenses.expenses;
    if (expensesList.length > 0) {
        const expenseToUpdate = expensesList.find((expense) => !expense.isLocked) ?? expensesList[0];
        const expenseUpdate: UpdateExpenseRequest = {
            description: `${expenseToUpdate.description} (updated)`,
            category: 'shopping',
        };
        await runQueued(() => driver.updateExpense(expenseToUpdate.id, expenseUpdate, adminUser.token));
        const updatedExpenseDetails = await runQueued(() => driver.getExpenseFullDetails(expenseToUpdate.id, adminUser.token));
        console.log(`Updated expense ${expenseToUpdate.id} in "Large Group": "${updatedExpenseDetails.expense.description}"`);
    }

    let currentMembers = groupMemberships.get(largeGroup.id) ?? [];

    const settlementsList = fullDetails.settlements.settlements;
    if (settlementsList.length > 0) {
        const settlementToUpdate = settlementsList[0];
        const settlementCreator = currentMembers.find((user) => user.uid === settlementToUpdate.payer.uid)
            ?? currentMembers.find((user) => user.uid === settlementToUpdate.payee.uid);

        if (settlementCreator) {
            const settlementUpdate: UpdateSettlementRequest = {
                note: 'Updated after review',
                date: toISOString(new Date().toISOString()),
            };
            await runQueued(() => driver.updateSettlement(settlementToUpdate.id, settlementUpdate, settlementCreator.token));
            console.log(`Updated settlement ${settlementToUpdate.id} in "Large Group"`);
        } else {
            console.log(`Skipped updating settlement ${settlementToUpdate.id} because creator token was unavailable`);
        }
    }

    if (settlementsList.length > 1) {
        const settlementToDelete = settlementsList[settlementsList.length - 1];
        const settlementCreator = currentMembers.find((user) => user.uid === settlementToDelete.payer.uid)
            ?? currentMembers.find((user) => user.uid === settlementToDelete.payee.uid)
            ?? adminUser;

        await runQueued(() => driver.deleteSettlement(settlementToDelete.id, settlementCreator.token));
        console.log(`Deleted settlement ${settlementToDelete.id} from "Large Group"`);
    }

    const memberDetails = largeGroup.memberDetails ?? [];
    const viewerMember = memberDetails.find((member) => member.memberRole === MemberRoles.VIEWER);

    const balancesByCurrency = fullDetails.balances.balancesByCurrency ?? {};
    const balanceCurrencies = Object.keys(balancesByCurrency);
    const membersWithZeroBalance = new Set<string>(
        memberDetails
            .filter((member) =>
                balanceCurrencies.every((currency) => {
                    const currencyBalances = balancesByCurrency[currency];
                    if (!currencyBalances) return true;
                    const userBalance = currencyBalances[member.uid];
                    if (!userBalance || userBalance.netBalance === undefined) return true;
                    return isZeroAmount(userBalance.netBalance, currency);
                })
            )
            .map((member) => member.uid),
    );

    const memberToLeave = memberDetails.find(
        (member) =>
            member.memberRole === MemberRoles.MEMBER
            && member.uid !== viewerMember?.uid
            && membersWithZeroBalance.has(member.uid),
    );
    if (memberToLeave) {
        const leavingUser = currentMembers.find((user) => user.uid === memberToLeave.uid);
        if (leavingUser) {
            await runQueued(() => driver.leaveGroup(largeGroup.id, leavingUser.token));
            currentMembers = currentMembers.filter((user) => user.uid !== leavingUser.uid);
            groupMemberships.set(largeGroup.id, currentMembers);
            console.log(`${leavingUser.displayName} left "Large Group" after updates`);
        }
    } else {
        console.log('Skipped member leave action because no zero-balance member was available');
    }

    const memberToRemove = memberDetails.find((member) =>
        member.memberRole === MemberRoles.MEMBER
        && member.uid !== viewerMember?.uid
        && member.uid !== memberToLeave?.uid
        && membersWithZeroBalance.has(member.uid)
    );
    if (memberToRemove) {
        const removerToken = [adminUser, ...currentMembers].find((user) => user.uid === memberToRemove.invitedBy)?.token ?? adminUser.token;
        await runQueued(() => driver.removeGroupMember(largeGroup.id, memberToRemove.uid, removerToken));
        currentMembers = currentMembers.filter((user) => user.uid !== memberToRemove.uid);
        groupMemberships.set(largeGroup.id, currentMembers);
        console.log(`Removed ${memberToRemove.groupDisplayName || memberToRemove.uid} from "Large Group"`);
    } else {
        console.log('Skipped member removal action because no zero-balance member was eligible');
    }

    const refreshedDetails = await runQueued(() => driver.getGroupFullDetails(largeGroup.id, adminUser.token));
    largeGroup.memberDetails = refreshedDetails.members.members;
    const pendingMembers = await runQueued(() => driver.getPendingMembers(largeGroup.id, adminUser.token));
    console.log(`"Large Group" now has ${largeGroup.memberDetails.length} active members and ${pendingMembers.length} pending members after finalize step`);
}

async function createSmallPaymentsForGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    // Skip empty group AND settled group (to preserve its settled state)
    const groupsWithPayments = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group');

    console.log(`Creating small payments/settlements for ${groupsWithPayments.length} groups`);

    // Process groups in batches to reduce contention
    const BATCH_SIZE = 2;

    for (let i = 0; i < groupsWithPayments.length; i += BATCH_SIZE) {
        const groupBatch = groupsWithPayments.slice(i, i + BATCH_SIZE);

        await Promise.all(
            groupBatch.map(async (group) => {
                // Get actual members of this group from tracked memberships
                const groupMembers = groupMemberships.get(group.id) || [];

                if (groupMembers.length < 2) return;

                // Create 1-3 small settlements per group
                const settlementCount = Math.floor(Math.random() * 2) + 1;

                for (let j = 0; j < settlementCount; j++) {
                    // Pick random payer and payee
                    const payer = groupMembers[Math.floor(Math.random() * groupMembers.length)];
                    const availablePayees = groupMembers.filter((m) => m.uid !== payer.uid);

                    if (availablePayees.length === 0) continue;

                    const payee = availablePayees[Math.floor(Math.random() * availablePayees.length)];

                    const paymentNotes = [
                        'Coffee payment',
                        'Lunch payback',
                        'Gas money',
                        'Uber split',
                        'Drinks last night',
                        'Pizza share',
                        'Movie tickets',
                        'Parking fee',
                        'Groceries split',
                        'Tip payback',
                        'Breakfast split',
                        'Snacks',
                    ];

                    // Randomly choose between GBP and EUR for settlements
                    const currency = Math.random() < 0.5 ? 'GBP' : 'EUR';
                    const rawPaymentAmount = Math.random() * 45 + 5;
                    const paymentAmount = normalizeAmount(rawPaymentAmount, currency);

                    const settlementData: CreateSettlementRequest = {
                        groupId: group.id,
                        payerId: payer.uid,
                        payeeId: payee.uid,
                        amount: paymentAmount,
                        currency: currency,
                        note: paymentNotes[Math.floor(Math.random() * paymentNotes.length)],
                        date: toISOString(new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString()), // Random date within last 15 days
                    };

                    await runQueued(() => driver.createSettlement(settlementData, payer.token));
                    const currencySymbol = currency === 'GBP' ? '£' : '€';
                    console.log(`Created small payment: ${payer.displayName} → ${payee.displayName} ${currencySymbol}${paymentAmount} in ${group.name}`);
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                console.log(`Created ${settlementCount} small payments for group: ${group.name}`);
            }),
        );
    }

    console.log(`✓ Finished creating small payments for all groups`);
}

async function deleteSomeExpensesFromGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>): Promise<void> {
    // Skip empty group and settled group (to preserve their states)
    const groupsWithExpenses = groups.filter((g) => g.name !== 'Empty Group' && g.name !== 'Settled Group');

    console.log(`Deleting some expenses from ${groupsWithExpenses.length} groups to test deletion functionality`);

    let totalDeleted = 0;

    for (const group of groupsWithExpenses) {
        // Get actual members of this group from tracked memberships and pick one to perform deletion
        const groupMembers = groupMemberships.get(group.id) || [];
        const deleter = groupMembers.find((u) => u.uid === group.createdBy) || groupMembers[0];
        if (!deleter) {
            console.warn(`No valid user found to delete expenses from group: ${group.name}`);
            continue;
        }

        // Get expenses for this group
        const { expenses } = await runQueued(() => driver.getGroupExpenses(group.id, deleter.token));

        if (!expenses || expenses.length === 0) {
            console.log(`No expenses found in group: ${group.name}`);
            continue;
        }

        // Determine how many to delete (1-2 expenses, but at least 1 per group)
        const deleteCount = Math.min(
            Math.floor(Math.random() * 2) + 1, // 1 or 2 expenses
            Math.max(1, Math.floor(expenses.length * 0.2)), // Or 20% of expenses, whichever is less
        );

        // Randomly select expenses to delete
        const shuffled = [...expenses].sort(() => 0.5 - Math.random());
        const expensesToDelete = shuffled.slice(0, deleteCount);

        // Delete the selected expenses
        for (const expense of expensesToDelete) {
            await runQueued(() => driver.deleteExpense(expense.id, deleter.token));
            totalDeleted++;
            const currencySymbol = expense.currency === 'GBP' ? '£' : expense.currency === 'EUR' ? '€' : '$';
            console.log(`Deleted expense: "${expense.description}" (${currencySymbol}${expense.amount}) from ${group.name}`);
        }

        console.log(`Deleted ${deleteCount} expense(s) from group: ${group.name}`);
    }

    console.log(`✓ Finished deleting expenses. Total deleted: ${totalDeleted} expenses across all groups`);
}

async function createCommentsForGroups(groups: GroupWithInvite[], groupMemberships: Map<string, AuthenticatedFirebaseUser[]>, config: TestDataConfig): Promise<void> {
    console.log(`Creating comments for all groups`);

    const commentTemplates = [
        'Thanks for adding this!',
        'Can we split this differently?',
        'I paid for this already',
        'Let me know when you get this',
        'Great, all sorted',
        'Just a reminder about this expense',
        'This looks good to me',
        'I think the amount might be wrong',
        'Can we discuss this later?',
        'Perfect, thanks!',
        'Added the receipt',
        'Confirmed',
        'All good here',
        'Just checking in on this',
        'Let me double check',
        'Looks correct',
        'Thanks for the update',
        'Can you verify this?',
        'Approved',
        'Noted',
        'Got it',
        'Will pay this weekend',
        'Already settled',
        'Missing some details',
        'Can you add more info?',
        'Thanks for organizing',
        'Makes sense',
        'Agreed',
        'Will handle this tomorrow',
        'Processed',
        'Updated the amount',
        'Fixed the split',
        'Changed the date',
        'Added participants',
        'Verified with receipt',
        'Paid via bank transfer',
        'Cash payment made',
        'Venmo sent',
        'PayPal completed',
        'Waiting for confirmation',
    ];

    let totalComments = 0;
    let totalGroupComments = 0;
    let totalExpenseComments = 0;

    for (const group of groups) {
        const groupMembers = groupMemberships.get(group.id) || [];
        if (groupMembers.length === 0) continue;

        // Determine comment counts based on group type
        let groupCommentsToCreate = 0;
        let expenseCommentsToCreate = 0;

        if (group.name === 'Large Group') {
            const { largeGroupGroupComments } = config;
            groupCommentsToCreate = randomInt(largeGroupGroupComments.min, largeGroupGroupComments.max);
            expenseCommentsToCreate = 0; // Calculated after fetching expenses
        } else if (group.name === 'Empty Group') {
            // Just group-level comments for Empty Group (3-5)
            groupCommentsToCreate = Math.floor(Math.random() * 3) + 3;
            expenseCommentsToCreate = 0; // No expenses in Empty Group
        } else {
            // Regular groups get group comments (2-4)
            groupCommentsToCreate = Math.floor(Math.random() * 3) + 2;
            // And expense comments (2-6)
            expenseCommentsToCreate = Math.floor(Math.random() * 5) + 2;
        }

        // Get expenses for this group (to add expense comments)
        const expensesResponse = await runQueued(() => driver.getGroupExpenses(group.id, groupMembers[0].token));
        const expenses = expensesResponse?.expenses ?? [];

        const expenseCommentTargets: string[] = [];
        if (group.name === 'Large Group') {
            for (const expense of expenses) {
                const { largeGroupExpenseCommentsPerExpense } = config;
                const count = randomInt(largeGroupExpenseCommentsPerExpense.min, largeGroupExpenseCommentsPerExpense.max);
                expenseCommentsToCreate += count;
                for (let i = 0; i < count; i++) {
                    expenseCommentTargets.push(expense.id);
                }
            }
        } else if (expenseCommentsToCreate > 0 && expenses.length > 0) {
            for (let i = 0; i < expenseCommentsToCreate; i++) {
                const targetExpense = expenses[Math.floor(Math.random() * expenses.length)];
                if (targetExpense) {
                    expenseCommentTargets.push(targetExpense.id);
                }
            }
        }

        expenseCommentsToCreate = expenseCommentTargets.length;

        const totalForGroup = groupCommentsToCreate + expenseCommentsToCreate;
        console.log(`Creating ${totalForGroup} comments for group "${group.name}" (${groupCommentsToCreate} group, ${expenseCommentsToCreate} expense)`);

        const commentPromises = [];

        // Create group-level comments
        for (let i = 0; i < groupCommentsToCreate; i++) {
            const commenter = groupMembers[Math.floor(Math.random() * groupMembers.length)];
            const commentText = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
            commentPromises.push(runQueued(() => driver.createComment(group.id, 'group', commentText, commenter.token)));

            // Process in batches to avoid overwhelming the API
            if (commentPromises.length >= 5) {
                await Promise.all(commentPromises.splice(0, 5));
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }

        // Create expense-level comments (if expenses exist)
        if (expenseCommentTargets.length > 0) {
            for (const expenseId of expenseCommentTargets) {
                const commenter = groupMembers[Math.floor(Math.random() * groupMembers.length)];
                const commentText = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
                commentPromises.push(runQueued(() => driver.createComment(expenseId, 'expense', commentText, commenter.token)));

                // Process in batches to avoid overwhelming the API
                if (commentPromises.length >= 5) {
                    await Promise.all(commentPromises.splice(0, 5));
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
        }

        // Process remaining comments
        if (commentPromises.length > 0) {
            await Promise.all(commentPromises);
        }

        totalComments += totalForGroup;
        totalGroupComments += groupCommentsToCreate;
        totalExpenseComments += expenseCommentsToCreate;
        console.log(`Created ${totalForGroup} comments for group: ${group.name}`);
    }

    console.log(`✓ Finished creating comments. Total created: ${totalComments} comments across all groups (${totalGroupComments} group-level, ${totalExpenseComments} expense-level)`);
}

export async function generateFullTestData(): Promise<void> {
    const testConfig = getTestConfig();
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    const logTiming = (phase: string, startMs: number) => {
        const duration = Date.now() - startMs;
        timings[phase] = duration;
        console.log(`⏱️  ${phase} completed in ${duration}ms`);
    };

    console.log(`🚀 Starting test data generation in ${testConfig.mode} mode`);

    // Initialize test pool users first (before regular test data)
    console.log('Initializing test user pool...');
    const poolInitStart = Date.now();
    await createTestPoolUsers();
    logTiming('Test pool initialization', poolInitStart);

    // Generate users based on config
    const TEST_USERS = generateTestUserRegistrations(testConfig);

    // Create first 3 test users in parallel
    console.log(`Creating first 3 test users in parallel...`);
    const userCreationStart = Date.now();

    // Create first 3 users in parallel
    const firstThreeUsers = TEST_USERS.slice(0, 3);
    const remainingUsers = TEST_USERS.slice(3);

    const additionalFirstUsers = firstThreeUsers.slice(1);
    const [billSplitterUser, ...additionalParallelUsers] = await Promise.all([
        generateBillSplitterUser(),
        ...additionalFirstUsers.map((userInfo) =>
            (async function(userInfo: UserRegistration): Promise<AuthenticatedFirebaseUser> {
                return await runQueued(() => driver.createUser(userInfo));
            })(userInfo)
        ),
    ]);
    const parallelUsers = [billSplitterUser, ...additionalParallelUsers];
    console.log(`✓ Created ${parallelUsers.length} users in parallel`);

    // Create remaining users sequentially if any
    const sequentialUsers = [];
    for (const userInfo of remainingUsers) {
        const user = await runQueued(() => driver.createUser(userInfo));
        sequentialUsers.push(user);
    }

    const users = [...parallelUsers, ...sequentialUsers];
    console.log(`✓ Total created ${users.length} users (${parallelUsers.length} parallel, ${sequentialUsers.length} sequential)`);
    logTiming('User creation', userCreationStart);

    // test1@test.com creates groups and collects invite links
    console.log(`Creating ${testConfig.groupCount} groups with rotating creators...`);
    const groupCreationStart = Date.now();
    const test1User = users[0]; // test1@test.com
    const groupCreators = users.slice(0, Math.min(users.length, 6));
    const creatorNames = groupCreators.map((creator) => creator.displayName).join(', ');
    console.log(`Group creators participating: ${creatorNames}`);
    const groupsWithInvites = await createGroups(groupCreators, testConfig);
    console.log(`✓ Created ${groupsWithInvites.length} groups with invite links`);
    logTiming('Group creation', groupCreationStart);

    // Other users randomly join ~70% of groups and track memberships
    console.log('Having users randomly join groups...');
    const joinGroupsStart = Date.now();
    const groupMemberships = await joinGroupsRandomly(users, groupsWithInvites);
    console.log('✓ Users have joined groups randomly');
    logTiming('Group joining', joinGroupsStart);

    // IMPORTANT: Refresh group data after joins to get updated member lists
    console.log('Refreshing group data to get updated member lists...');
    const refreshStart = Date.now();
    const refreshedGroups = await Promise.all(
        groupsWithInvites.map(async (group) => {
            const membersForGroup = groupMemberships.get(group.id) ?? [];
            const accessibleUser = membersForGroup.find((member) => member.uid === test1User.uid) ?? membersForGroup[0] ?? test1User;

            const { group: groupData, members } = await runQueued(() => driver.getGroupFullDetails(group.id, accessibleUser.token));
            return {
                ...groupData,
                inviteLink: group.inviteLink,
                memberDetails: members.members,
            } as GroupWithInvite;
        }),
    );
    console.log('✓ Refreshed group data with updated members');
    logTiming('Group data refresh', refreshStart);

    console.log('Ensuring Bill Splitter is a member of every group...');
    await ensureBillSplitterInAllGroups(refreshedGroups, test1User, groupMemberships);
    console.log('✓ Bill Splitter confirmed as member of all groups');

    console.log('Configuring advanced scenarios for "Large Group"...');
    const largeGroupAdvancedStart = Date.now();
    await configureLargeGroupAdvancedScenarios(refreshedGroups, groupMemberships, users);
    logTiming('Large group advanced configuration', largeGroupAdvancedStart);

    // Create random expenses for regular groups (excluding special ones)
    console.log('Creating random expenses for regular groups...');
    const regularExpensesStart = Date.now();
    await createRandomExpensesForGroups(refreshedGroups, groupMemberships);
    console.log('✓ Created random expenses for regular groups');
    logTiming('Regular expenses creation', regularExpensesStart);

    // Create special balanced expenses for "Settled Group"
    console.log('Creating balanced expenses for "Settled Group"...');
    const balancedExpensesStart = Date.now();
    await createBalancedExpensesForSettledGroup(refreshedGroups, groupMemberships);
    console.log('✓ Created balanced expenses');
    logTiming('Balanced expenses creation', balancedExpensesStart);

    // Create many expenses for "Large Group" for pagination testing
    console.log('Creating many expenses for "Large Group"...');
    const largeGroupExpensesStart = Date.now();
    await createManyExpensesForLargeGroup(refreshedGroups, groupMemberships, testConfig);
    console.log('✓ Created many expenses for pagination testing');
    logTiming('Large group expenses creation', largeGroupExpensesStart);

    // Create many settlements for "Large Group" for pagination testing
    console.log('Creating many settlements for "Large Group"...');
    const largeGroupSettlementsStart = Date.now();
    await createManySettlementsForLargeGroup(refreshedGroups, groupMemberships, testConfig);
    console.log('✓ Created many settlements for pagination testing');
    logTiming('Large group settlements creation', largeGroupSettlementsStart);

    console.log('Finalizing advanced scenarios for "Large Group"...');
    const largeGroupFinalizeStart = Date.now();
    await finalizeLargeGroupAdvancedData(refreshedGroups, groupMemberships);
    logTiming('Large group finalize', largeGroupFinalizeStart);

    // Create small payments/settlements for groups to demonstrate payment functionality
    console.log('Creating small payments/settlements for groups...');
    const smallPaymentsStart = Date.now();
    await createSmallPaymentsForGroups(refreshedGroups, groupMemberships);
    console.log('✓ Created small payments/settlements');
    logTiming('Small payments creation', smallPaymentsStart);

    // Create comments for all groups (including lots for Large Group)
    console.log('Creating comments for all groups...');
    const commentsStart = Date.now();
    await createCommentsForGroups(refreshedGroups, groupMemberships, testConfig);
    console.log('✓ Created comments for all groups');
    logTiming('Comments creation', commentsStart);

    // Delete some expenses to test deletion functionality and show deleted state
    console.log('Deleting some expenses to test deletion functionality...');
    const deletionStart = Date.now();
    await deleteSomeExpensesFromGroups(refreshedGroups, groupMemberships);
    console.log('✓ Deleted some expenses from groups');
    logTiming('Expense deletion', deletionStart);

    const totalTime = Date.now() - startTime;
    console.log('🎉 Test data generation completed', {
        users: users.length,
        groups: refreshedGroups.length,
        totalTimeMs: totalTime,
        totalTimeSeconds: (totalTime / 1000).toFixed(2),
        mode: testConfig.mode,
        timings,
        testCredentials: TEST_USERS.map((u) => ({ email: u.email, password: u.password })),
        inviteLinks: refreshedGroups.map((g) => ({ name: g.name, inviteLink: g.inviteLink })),
    });
}
