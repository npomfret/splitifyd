### **Type Declaration Analysis and Refactoring Recommendations**

This report provides an analysis of the type definitions in `packages/shared/src/shared-types.ts` and the broader codebase. While the project correctly centralizes all shared types, there are several opportunities within the main `shared-types.ts` file to reduce duplication and improve maintainability by leveraging more of TypeScript's features.

### Part 1: Refactoring Opportunities in `shared-types.ts`

#### 1. User-Related Types

**Observation:**
The types `BaseUser`, `FirebaseUser`, `AuthenticatedFirebaseUser`, and `RegisteredUser` are built on top of each other in a clear chain of inheritance. However, this is not expressed in the type definitions, leading to repeated fields.

**Current State:**
```typescript
export interface BaseUser {
    email: string;
    displayName: string;
}

export interface FirebaseUser extends BaseUser {
    uid: string;
}

export interface AuthenticatedFirebaseUser extends FirebaseUser {
    token: string;
}
```
*(Note: The current implementation already uses `extends` correctly here, which is good. The main opportunity is with `GroupMemberWithProfile`)*.

#### 2. Group Member Types

**Observation:**
The `GroupMemberWithProfile` type is a combination of `RegisteredUser` and `GroupMember`. It re-implements fields from `GroupMember` and manually renames fields like `role` to `memberRole` to avoid conflicts. This is a major source of duplication.

**Current State:**
```typescript
export interface GroupMember {
    joinedAt: string;
    role: MemberRole;
    theme: UserThemeColor;
    // ...
}

export interface GroupMemberWithProfile extends RegisteredUser {
    // Duplicated fields from GroupMember
    joinedAt: string;
    memberRole: MemberRole; // Manually renamed
    invitedBy?: string;
    memberStatus: MemberStatus; // Manually renamed
    // ...
}
```

**Recommendation:**
Use a TypeScript intersection (`&`) and the `Omit` utility type to create a composite type. This removes all duplication and makes the relationship between the types explicit.

**Proposed Refactoring:**
```typescript
// No change to GroupMember
export interface GroupMember {
    joinedAt: string;
    role: MemberRole;
    theme: UserThemeColor;
    status: MemberStatus;
    // ...
}

// Refactored GroupMemberWithProfile
export type GroupMemberWithProfile = RegisteredUser & Omit<GroupMember, 'theme'> & {
    memberRole: MemberRole; // Add the renamed 'role'
    memberStatus: MemberStatus; // Add the renamed 'status'
};
```
*Benefit:* `GroupMemberWithProfile` is now guaranteed to have all the properties of a `RegisteredUser` and a `GroupMember` without duplicating any fields. `Omit` is used to prevent the `theme` field from being included twice.

#### 3. Document and Request/Response Types

**Observation:**
There is a recurring pattern where one type is a slight variation of another.
1.  **Document Types:** `PolicyDocument` is essentially the `Policy` type plus `id` and timestamp fields.
2.  **Request Types:** `UpdateExpenseRequest` and `UpdateSettlementRequest` are subsets of their `Create...` counterparts, with all fields being optional.
3.  **API Serialization:** `CommentApiResponse` is identical to `Comment`, but with `FirestoreTimestamp` fields converted to `string`.

**Recommendation:**
Use TypeScript utility types like `Partial<T>`, `Omit<T, K>`, and custom generic types to build these variations programmatically.

**Proposed Refactoring Examples:**

**A. Document Types:**
Create a generic `BaseDocument` and extend from it.
```typescript
// Proposed new generic type
interface BaseDocument {
    id: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

// Refactored PolicyDocument
export interface Policy {
    policyName: string;
    currentVersionHash: string;
    versions: Record<string, PolicyVersion>;
}

export interface PolicyDocument extends Policy, BaseDocument {}
```

**B. Request/Update Types:**
Use `Partial<T>` to create the `Update` types from the `Create` types.
```typescript
// For Expenses
export interface CreateExpenseRequest {
    groupId: string;
    description: string;
    amount: number;
    // ... all required fields
}

// Refactored UpdateExpenseRequest
export type UpdateExpenseRequest = Partial<Omit<CreateExpenseRequest, 'groupId'>>;
```
*Benefit:* You no longer need to maintain two separate but similar interfaces. Any change to `CreateExpenseRequest` is automatically reflected in `UpdateExpenseRequest`.

**C. API Serialization Types:**
Create a generic type to handle the timestamp-to-string conversion.
```typescript
// Proposed new generic type
type WithStringTimestamps<T> = {
  [K in keyof T]: T[K] extends FirestoreTimestamp ? string : T[K];
};

// Refactored CommentApiResponse
export interface Comment {
    id: string;
    text: string;
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

export type CommentApiResponse = WithStringTimestamps<Comment>;
```
*Benefit:* This pattern can be reused for any other type that needs its `FirestoreTimestamp` fields converted to strings for an API response, ensuring consistency.

### Part 2: Analysis of Duplicate Types in the Codebase

**Findings:**
A full codebase search for `interface` and `type` definitions outside of the `packages/shared` directory yielded **no results**.

This is excellent and indicates that the project adheres to a strict "single source of truth" policy for type definitions. All shared types are correctly centralized, and there is no duplication across the `firebase` and `webapp-v2` projects.

### Conclusion

The project's type definition strategy is structurally sound due to its excellent centralization. The key areas for improvement lie within the `shared-types.ts` file itself.

By applying utility types like `Omit`, `Partial`, and intersections (`&`), we can significantly reduce code duplication, improve maintainability, and create more robust and expressive types that clearly define the relationships between different data structures. These changes would make the codebase cleaner and easier to manage long-term.
