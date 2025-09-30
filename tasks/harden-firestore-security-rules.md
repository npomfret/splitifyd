# CRITICAL TASK: Harden Firestore Security & Data Integrity

## 1. Overview

This document covers critical security issues in the Firebase codebase. Phase 1 and Phase 2 have been completed. Phase 3 requires a **revised approach** based on implementation learnings.

**UPDATE (January 2025)**: Initial Phase 3 implementation attempts revealed that transaction validation with FieldValues is more complex than anticipated. This document has been revised with a more practical, incremental approach.

---

## 2. Current Status (January 2025)

### ✅ **Phase 1: COMPLETED** - Schema Validation for FirestoreWriter Updates
- All FirestoreWriter update methods (updateUser, updateGroup, etc.) have comprehensive schema validation
- Graceful FieldValue handling implemented
- Zero breaking changes to existing functionality

### ✅ **Phase 2: COMPLETED** - Firestore Security Rules
- Security rules (`firestore.rules`) created and deployed
- Database-level access control enforcing backend-only writes
- Comprehensive test suite for security rules

### ⚠️ **Phase 3: REVISED APPROACH NEEDED** - Transaction Validation Challenges

**Key Learning:** Transaction validation with FieldValue operations (serverTimestamp, arrayUnion, etc.) requires special handling that differs from regular update validation.

---

## 3. Critical Security Gaps Found (January 2025)

### 3.1. **Transaction Methods Have NO Validation**

The FirestoreWriter transaction methods bypass all schema validation:

**Unvalidated Transaction Methods:**
- `createInTransaction()` - Creates documents without any validation
- `updateInTransaction()` - Updates documents without schema checking
- `updateGroupInTransaction()` - Updates groups without validation
- `bulkDeleteInTransaction()` - Deletes without verification

**Risk Level: HIGH** - These methods can corrupt data by writing invalid schemas directly to Firestore.

### 3.2. **Direct Firestore Writes Still Exist**

**Critical Direct Writes Found:**
- **`test/policy-handlers.ts`** (Lines 59, 126): Direct user document updates
- **`GroupService.ts`** (Lines 724, 781, 887, 933): Transaction updates without validation
- **`TestUserPoolService.ts`** (Lines 93, 108): Direct writes to test pool collection

### 3.3. **Generic Methods Lack Validation**

**Unvalidated Generic Operations:**
- `bulkCreate()` - Only logs warnings, no validation
- `bulkUpdate()` - Only logs warnings, no validation
- `createDocument()` - Generic creation without schema enforcement

---

## 4. **Phase 3: REVISED Implementation Plan (Incremental Approach)**

### **Key Challenge Identified:**
Transaction operations often mix business data with FieldValue operations (serverTimestamp, arrayUnion, etc.), making traditional validation approaches problematic. A more nuanced, incremental approach is needed.

### **Step 1: Infrastructure Preparation (SAFE - Do First)**

#### 1.1 Add Missing Collection Constants
```typescript
// In packages/shared/src/shared-types.ts
export const FirestoreCollections = {
    // ... existing collections
    USER_NOTIFICATIONS: 'user-notifications',
    TRANSACTION_CHANGES: 'transaction-changes',
    // Add any other missing collections
} as const;
```

#### 1.2 Create Schema Mapping
```typescript
// In FirestoreWriter.ts
private getSchemaForCollection(collection: string) {
    const schemaMap = {
        [FirestoreCollections.USERS]: UserDocumentSchema,
        [FirestoreCollections.GROUPS]: GroupDocumentSchema,
        [FirestoreCollections.EXPENSES]: ExpenseDocumentSchema,
        [FirestoreCollections.SETTLEMENTS]: SettlementDocumentSchema,
        [FirestoreCollections.POLICIES]: PolicyDocumentSchema,
        [FirestoreCollections.COMMENTS]: CommentDataSchema,
        [FirestoreCollections.GROUP_MEMBERSHIPS]: TopLevelGroupMemberSchema,
        [FirestoreCollections.USER_NOTIFICATIONS]: UserNotificationDocumentSchema,
        [FirestoreCollections.TRANSACTION_CHANGES]: TransactionChangeDocumentSchema,
        [FirestoreCollections.BALANCE_CHANGES]: BalanceChangeDocumentSchema,
    };

    const schema = schemaMap[collection as keyof typeof schemaMap];
    if (!schema) {
        // Log warning but don't fail - allows gradual migration
        logger.warn(`No schema found for collection: ${collection}`);
        return null;
    }
    return schema;
}
```

### **Step 2: Migrate Direct Writes (SAFE - No FieldValue Issues)**

#### 2.1 Replace Direct Writes in test/policy-handlers.ts
These don't use FieldValues, so they're safe to migrate:
```typescript
// Replace direct firestore calls with FirestoreWriter
await firestoreWriter.updateUser(decodedToken.uid, {
    acceptedPolicies: {},
});
```

#### 2.2 Standardize Rules Configuration
- Rename `firestore.prod.rules` to `firestore.rules`
- Update `firebase.json` to point to `firestore.rules`
- Add documentation comments

### **Step 3: Transaction Validation (COMPLEX - Requires Special Handling)**

#### 3.1 Create Validation Strategy for Mixed Data

**Option A: Selective Field Validation**
```typescript
// Only validate fields that aren't FieldValues
private validateTransactionData(collection: string, data: any): boolean {
    const schema = this.getSchemaForCollection(collection);
    if (!schema) return true; // No schema = skip validation

    // Extract only non-FieldValue fields for validation
    const fieldsToValidate = {};
    for (const [key, value] of Object.entries(data)) {
        if (!isFieldValue(value)) {
            fieldsToValidate[key] = value;
        }
    }

    // Validate partial data (only business fields)
    return validatePartialData(schema, fieldsToValidate);
}
```

**Option B: Skip Validation When FieldValues Present**
```typescript
// Skip validation entirely if FieldValues are detected
private shouldValidateTransaction(data: any): boolean {
    return !Object.values(data).some(value => isFieldValue(value));
}
```

**Option C: Two-Phase Transaction Methods**
```typescript
// Separate methods for validated vs. unvalidated operations
updateInTransaction(...) // No validation - for mixed data
updateInTransactionValidated(...) // Full validation - for pure business data
```

### **Step 4: Monitoring & Gradual Rollout**

#### 4.1 Add Metrics Without Breaking
```typescript
// Log validation coverage without enforcing
private logValidationCoverage(operation: string, validated: boolean) {
    metrics.track('firestore_validation', {
        operation,
        validated,
        collection,
    });
}
```

#### 4.2 Gradual Migration Path
1. Deploy logging-only version first
2. Monitor which operations can be safely validated
3. Gradually enable validation for safe operations
4. Leave complex FieldValue operations unvalidated (with logging)

---

## 5. **Implementation Safety**

### **No Breaking Changes Strategy**
1. **Maintain Method Signatures** - Add validation internally without changing external APIs
2. **Graceful FieldValue Handling** - Skip validation only for FieldValue operations
3. **Comprehensive Logging** - Log all validation skips and successes
4. **Backward Compatibility** - Ensure all existing tests pass

### **Validation Approach**
1. **Auto-detect Collection** - Determine schema from document path
2. **Fetch-and-Merge** - Get existing document, merge updates, validate full object
3. **Smart Skipping** - Only skip validation for FieldValue operations
4. **Error Context** - Provide detailed validation error messages

### **Testing Strategy**
1. **Run All Tests** - Ensure no regression in existing functionality
2. **Add Validation Tests** - Test transaction validation edge cases
3. **Monitor Coverage** - Track validation success/skip rates
4. **Performance Testing** - Ensure validation doesn't impact performance

---

## 6. **Expected Outcomes**

### **Security Benefits**
- **100% Validation Coverage** - All Firestore writes validated against schemas
- **Zero Unvalidated Paths** - No way to write invalid data to Firestore
- **Transaction Safety** - Even complex transactions enforce data integrity
- **Defense in Depth** - Both application-level and database-level security

### **Developer Experience**
- **Clear Error Messages** - Detailed validation failures help debugging
- **No Performance Impact** - Validation is fast and efficient
- **Seamless Integration** - No changes required to existing code
- **Monitoring Visibility** - Clear metrics on validation coverage

---

## 7. **Risk Assessment**

### **Current Risk Level: HIGH**
- **Data Corruption Possible** - Invalid data can be written via transactions
- **Schema Drift Risk** - No enforcement of data consistency in transactions
- **Production Impact** - Malformed data could break application logic

### **Post-Implementation Risk: MINIMAL**
- **Comprehensive Protection** - All write paths validated
- **Graceful Degradation** - FieldValue operations still work
- **Monitoring Visibility** - Clear tracking of all write operations

---

## 8. **Next Actions - REVISED Implementation Plan**

### **CRITICAL LEARNING FROM FAILED ATTEMPTS (January 2025)**

Previous implementation attempts failed due to fundamental complexity in validating mixed data (business fields + FieldValue operations). The revised plan below takes an incremental, practical approach.

### **Step 1: Infrastructure Preparation (SAFE - Do First)**
1. **Add Missing Collection Constants** - Complete the FirestoreCollections enum
2. **Create Schema Mapping** - Add getSchemaForCollection() helper method
3. **Test Infrastructure** - Ensure all existing tests still pass

### **Step 2: Migrate Safe Direct Writes (NO FieldValue Issues)**
1. **Fix test/policy-handlers.ts** - Replace direct Firestore calls with FirestoreWriter
2. **Fix TestUserPoolService.ts** - Create proper FirestoreWriter methods
3. **Standardize Rules Config** - Rename firestore.prod.rules to firestore.rules
4. **Verify Changes** - Run tests to ensure no regression

### **Step 3: Transaction Validation (COMPLEX - Choose Strategy)**

**Select ONE of these validation approaches:**

**Option A: Selective Field Validation**
- Validate only non-FieldValue fields in transaction data
- Skip FieldValue operations but validate business logic fields
- Provides partial protection while avoiding validation failures

**Option B: Skip Validation When FieldValues Present**
- Detect FieldValue operations and skip validation entirely for those transactions
- Maintain compatibility but lose validation benefits for mixed data
- Add comprehensive logging for monitoring

**Option C: Two-Phase Transaction Methods**
- Create separate validated vs unvalidated transaction methods
- Migrate safe operations to validated methods gradually
- Leave complex FieldValue operations in unvalidated methods

### **Step 4: Monitoring & Gradual Rollout**
1. **Add Metrics** - Track validation coverage without enforcement
2. **Monitor Patterns** - Identify which operations can be safely validated
3. **Gradual Migration** - Enable validation for operations proven safe
4. **Documentation** - Update developer guidelines with learnings

---

## 9. **Firestore Rules Enhancement**

### **Current Rules Configuration Analysis**

**✅ What's Working:**
- Security rules (`firestore.rules`) are properly deployed and enforced
- Database-level access control is working correctly
- Security rules prevent unauthorized reads/writes

**⚠️ Rules Issues Found:**
1. **Misleading File Name**: Currently using `firestore.prod.rules` - implies dev/prod split
2. **No Schema Validation**: Rules only handle access control, not data validation
3. **Naming Convention**: Should be `firestore.rules` since there's no dev vs prod difference

### **Rules Enhancement Plan**

#### **Priority 4: Standardize Rules Configuration**

**Step 4.1: Rename Rules File**
```bash
# Rename to standard filename (no dev/prod split)
mv firebase/firestore.prod.rules firebase/firestore.rules
```

**Step 4.2: Update Firebase Configuration**
Update `firebase.json` to point to the standard rules file:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

**Step 4.3: Enhance Rules Documentation**
Add clear comments to `firestore.rules`:
```javascript
// FIRESTORE SECURITY RULES
// These rules are used in ALL environments (dev, staging, production)
// Schema validation is handled at the application level via FirestoreWriter
```

**Step 4.3: Consider Schema Validation in Rules (Optional)**
Evaluate adding basic schema validation to rules:
```javascript
// Example: Basic user data validation
match /users/{userId} {
  allow write: if request.auth.uid == userId
    && isValidUserData(request.resource.data);
}

function isValidUserData(data) {
  return data.keys().hasAll(['email', 'displayName', 'role']) &&
         data.email is string &&
         data.displayName is string &&
         data.role in ['user', 'admin'];
}
```

### **Recommendation: Unified Rules Approach**

**Standardize on `firestore.rules`** for ALL environments because:
- ✅ **Environment Parity** - Dev and prod have identical code AND rules (no differences)
- ✅ **Clear Naming** - No misleading "prod" suffix implying dev/prod split
- ✅ **Simpler maintenance** - One set of rules, not multiple configurations
- ✅ **Better error messages** - Application validation provides detailed feedback
- ✅ **More flexible** - Easy schema updates without rule deployment
- ✅ **Currently secure** - Access control is properly enforced
- ✅ **No surprises** - What works in dev will work in prod

**Critical principle: Dev and prod must be identical to avoid deployment surprises.**

**Required changes:**
- Rename `firestore.prod.rules` to `firestore.rules` (standard naming)
- Update `firebase.json` to point to `firestore.rules`
- Add documentation clarifying these rules are used everywhere
- Focus on application-level validation gaps (Phases 1-3)

---

## 10. **Implementation Files**

### **Primary Changes**
- `firebase/functions/src/services/firestore/FirestoreWriter.ts` - Add transaction validation
- `firebase/functions/src/test/policy-handlers.ts` - Replace direct writes
- `firebase/functions/src/services/GroupService.ts` - Use validated transaction methods
- `firebase/functions/src/test-pool/TestUserPoolService.ts` - Create FirestoreWriter methods

### **Supporting Changes**
- Schema mapping utilities
- Validation helper methods
- Error handling improvements
- Logging enhancements

### **Rules Standardization**
- `firebase/firestore.prod.rules` - RENAME to `firebase/firestore.rules`
- `firebase/firebase.json` - Update to point to `firestore.rules`
- `firebase/firestore.rules` - Add documentation comments

---

## 11. **Conclusion - REVISED (January 2025)**

**Implementation complexity was underestimated.** While Phases 1 and 2 provided important foundations, **Phase 3 requires a more nuanced approach** due to the inherent complexity of validating mixed business/FieldValue data in transactions.

**Key Learnings from Failed Attempts:**
1. **FieldValue operations complicate validation** - serverTimestamp, arrayUnion, etc. resolve server-side
2. **Schema type mismatches are unavoidable** - Date objects vs ISO strings in schemas
3. **All-or-nothing validation is too rigid** - Mixed data requires flexible approaches
4. **Transaction validation needs special handling** - Different from regular update validation

**Remaining Security Issues (POST-REVISION):**
1. **Transaction methods still bypass validation** - But now we have realistic approaches to fix this
2. **Some direct Firestore writes remain** - These are easier to migrate incrementally
3. **Rules configuration needs cleanup** - Simple file rename operation

**Critical Principle: Incremental Progress Over Perfect Solution**

The revised implementation plan acknowledges that:
- ✅ **Perfect validation may not be achievable** for all transaction types
- ✅ **Partial validation is better than no validation**
- ✅ **Monitoring and gradual migration** reduces implementation risk
- ✅ **Three validation strategies** provide implementation flexibility
- ✅ **Infrastructure improvements** can be done safely first

**Environment parity principle maintained:** Dev and prod will have identical code AND rules - no configuration differences that could cause deployment surprises.

**Priority: HIGH (not CRITICAL)** - This work should proceed incrementally with the revised plan to avoid further implementation failures.