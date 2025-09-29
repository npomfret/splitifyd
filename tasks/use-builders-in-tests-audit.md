# Audit: Use of Builders in Tests

## 1. Overview

This report details an audit of all `.ts` test files within `__tests__` subdirectories to identify instances where raw data objects are created manually instead of using the prescribed builder pattern. The project guidelines in `docs/guides/testing.md` state that builders should be used to create test data to improve readability, maintainability, and focus tests on the relevant data.

## 2. Summary of Findings

The audit reveals that while many tests, especially newer ones, correctly use builders (e.g., `CreateGroupRequestBuilder`, `FirestoreExpenseBuilder`), several older test files still contain manual object creation for test data. This is most prevalent in unit tests for services and validation logic.

**Key Areas for Improvement:**

*   **Service Unit Tests:** Many service-level unit tests manually construct mock data for dependencies.
*   **Validation Unit Tests:** Validation tests often create objects with various invalid properties manually.
*   **Integration Tests:** Some integration tests still create request bodies or mock Firestore documents by hand.

## 3. Files Requiring Refactoring

The following is a list of files that contain instances of manual test data creation and would benefit from being refactored to use builders.

### `firebase/functions/src/__tests__/unit/permission-engine-async.test.ts`

**Violation:** Test data for `Group` and `GroupMember` documents are created as raw objects.

**Example:**

```typescript
// Snippet from permission-engine-async.test.ts

testGroup = {
    id: testGroupId,
    name: 'Test Group',
    description: 'Test Description',
    createdBy: 'creator123',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    securityPreset: SecurityPresets.OPEN,
    permissions: {
        expenseEditing: PermissionLevels.ANYONE,
        expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
        memberInvitation: PermissionLevels.ADMIN_ONLY,
        memberApproval: 'automatic',
        settingsManagement: PermissionLevels.ADMIN_ONLY,
    },
};

// ...

stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
    uid: testUserId,
    groupId: testGroupId,
    memberRole: MemberRoles.MEMBER,
    memberStatus: MemberStatuses.PENDING,
    joinedAt: '2023-01-01T00:00:00Z',
    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
});
```

**Recommendation:** Use `FirestoreGroupBuilder` and `GroupMemberDocumentBuilder` to construct this test data. This would make the setup cleaner and more aligned with project standards.

```typescript
// Recommended approach

import { FirestoreGroupBuilder, GroupMemberDocumentBuilder } from '@splitifyd/test-support';

testGroup = new FirestoreGroupBuilder()
    .withId(testGroupId)
    .withName('Test Group')
    .withCreatedBy('creator123')
    .withSecurityPreset(SecurityPresets.OPEN)
    .build();

// ...

const memberDoc = new GroupMemberDocumentBuilder()
    .withUserId(testUserId)
    .withGroupId(testGroupId)
    .withRole(MemberRoles.MEMBER)
    .withStatus(MemberStatuses.PENDING)
    .build();
stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);
```

### `firebase/functions/src/__tests__/unit/validation/InputValidation.test.ts`

**Violation:** `CreateExpenseRequest` objects are created manually for testing validation logic.

**Example:**

```typescript
// Snippet from InputValidation.test.ts

it('should reject zero amounts', () => {
    const expenseData = new CreateExpenseRequestBuilder()
        .withAmount(0)
        .build();

    expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
});
```

**Recommendation:** While this file already uses `CreateExpenseRequestBuilder`, it could be used more consistently to build the base valid object, and then properties can be overridden for specific invalid cases. The current usage is already good, but this is a reminder to maintain this pattern.

### `firebase/functions/src/__tests__/unit/validation/date-validation.test.ts`

**Violation:** Test data for expenses is created manually.

**Example:**
```typescript
// Snippet from date-validation.test.ts
const invalidDates = [
    'not-a-valid-date',
    '2023-13-45T25:99:99.999Z', // Invalid components
];

invalidDates.forEach((invalidDate) => {
    const expenseData = {
            date: invalidDate,
    };

    expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
});
```

**Recommendation:** Use `CreateExpenseRequestBuilder` to create a base valid object and then override the `date` property for each invalid case.

```typescript
// Recommended approach
invalidDates.forEach((invalidDate) => {
    const expenseData = new CreateExpenseRequestBuilder()
        .withDate(invalidDate)
        .build();

    expect(() => validateCreateExpense(expenseData)).toThrow(ApiError);
});
```

### `firebase/functions/src/__tests__/unit/services/UserService.test.ts`

**Violation:** User registration data is created as a raw object.

**Example:**
```typescript
// Snippet from UserService.test.ts
const registrationData = {
    email: 'newuser@example.com',
    password: 'SecurePass123!',
    displayName: 'New User',
    termsAccepted: true,
    cookiePolicyAccepted: true,
};
```

**Recommendation:** Use the `UserRegistrationBuilder` to create this data.

```typescript
// Recommended approach
import { UserRegistrationBuilder } from '@splitifyd/test-support';

const registrationData = new UserRegistrationBuilder()
    .withEmail('newuser@example.com')
    .withDisplayName('New User')
    .build();
```

## 4. Benefits of Using Builders

Adopting the builder pattern consistently across all tests will provide several benefits:

*   **Readability:** Tests become easier to read as the setup code is more declarative and focuses on the data relevant to the test case.
*   **Maintainability:** When data models change, updates only need to be made in the builder, not in every test file that uses the model.
*   **Reduced Errors:** Builders can enforce required fields and valid default values, reducing the chance of creating invalid test data.
*   **Consistency:** Enforces a consistent pattern for test data creation across the entire project.

## 5. Next Steps

It is recommended that the identified files be refactored to use the existing builder classes from the `@splitifyd/test-support` package. This will improve the overall quality and maintainability of the test suite.
