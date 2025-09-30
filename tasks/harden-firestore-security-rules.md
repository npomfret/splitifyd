# CRITICAL TASK: Harden Firestore Security & Data Integrity

## 1. Overview

This document covers two critical, related security issues discovered through deep analysis of the Firebase codebase. While Phase 1 and Phase 2 have been completed, **critical validation gaps remain that need immediate attention.**

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

### ❌ **Phase 3: CRITICAL GAPS IDENTIFIED** - Transaction Validation Missing

**URGENT:** Deep dive analysis reveals that the original task documentation is **significantly outdated**. Critical validation gaps exist in transaction operations.

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

## 4. **Phase 3: Critical Implementation Plan**

### **Priority 1: Fix Transaction Validation (IMMEDIATE)**

**Target:** `firebase/functions/src/services/firestore/FirestoreWriter.ts`

#### Step 3.1: Add Schema Validation to Transaction Methods

```typescript
// Current (UNSAFE)
updateInTransaction(transaction: Transaction, documentPath: string, updates: any): void {
    const docRef = this.db.doc(documentPath);
    transaction.update(docRef, {
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
    });
}

// Required (SAFE)
updateInTransaction(transaction: Transaction, documentPath: string, updates: any): void {
    // Validate updates against appropriate schema based on collection
    const collection = this.extractCollectionFromPath(documentPath);
    const documentId = this.extractDocumentIdFromPath(documentPath);

    this.validateTransactionUpdate(collection, documentId, updates);

    const docRef = this.db.doc(documentPath);
    transaction.update(docRef, {
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
    });
}
```

#### Step 3.2: Create Collection-to-Schema Mapping

```typescript
private getSchemaForCollection(collection: string) {
    const schemaMap = {
        [FirestoreCollections.USERS]: UserDocumentSchema,
        [FirestoreCollections.GROUPS]: GroupDocumentSchema,
        [FirestoreCollections.EXPENSES]: ExpenseDocumentSchema,
        [FirestoreCollections.SETTLEMENTS]: SettlementDocumentSchema,
        // Add all collections
    };
    return schemaMap[collection];
}
```

### **Priority 2: Migrate Direct Writes**

#### Step 3.3: Fix test/policy-handlers.ts
Replace lines 59 and 126:
```typescript
// Current (UNSAFE)
await firestore.collection(FirestoreCollections.USERS).doc(decodedToken.uid).update({
    acceptedPolicies: {},
});

// Required (SAFE)
await firestoreWriter.updateUser(decodedToken.uid, {
    acceptedPolicies: {},
});
```

#### Step 3.4: Fix GroupService.ts Transaction Writes
Replace direct transaction.update() calls with validated methods:
```typescript
// Current (UNSAFE)
transaction.update(doc.ref, {
    groupUpdatedAt: updatedData.updatedAt.toISOString(),
    updatedAt: this.dateHelpers.createTrueServerTimestamp(),
});

// Required (SAFE)
this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, {
    groupUpdatedAt: updatedData.updatedAt.toISOString(),
    updatedAt: this.dateHelpers.createTrueServerTimestamp(),
});
```

### **Priority 3: Enhance Generic Methods**

Make schema parameter required for all generic operations:
```typescript
// Make these signatures mandatory
bulkCreate(collection: string, documents: any[], schema: ZodSchema): Promise<BatchWriteResult>
bulkUpdate(collection: string, updates: any[], schema: ZodSchema): Promise<BatchWriteResult>
createDocument(collection: string, data: any, schema: ZodSchema): Promise<WriteResult>
```

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

## 8. **Next Actions**

### **Immediate (This Week)**
1. **Fix Transaction Validation** - Add schema validation to all transaction methods
2. **Migrate Critical Direct Writes** - Fix test/policy-handlers.ts and GroupService.ts
3. **Test Thoroughly** - Run full test suite to ensure no breakage

### **Short Term (Next Sprint)**
1. **Enhance Generic Methods** - Make schema validation mandatory
2. **Add Monitoring** - Track validation coverage metrics
3. **Documentation** - Update developer guidelines

### **Long Term**
1. **Runtime Enforcement** - Add development-time warnings for unvalidated writes
2. **Automated Testing** - Continuous validation coverage monitoring
3. **Performance Optimization** - Cache schemas and optimize validation paths

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

## 11. **Conclusion**

**The original assessment was incomplete.** While Phases 1 and 2 provided important foundations, **critical validation gaps remain in transaction operations and direct writes.**

**Key Security Issues:**
1. **Transaction methods bypass validation** - Critical data integrity risk
2. **Direct Firestore writes exist** - Unvalidated paths to database
3. **Rules configuration needs cleanup** - Obsolete files create confusion

**This is not optional** - these gaps represent real security vulnerabilities that can lead to data corruption in production. The implementation plan above provides a practical, efficient approach to close these gaps without breaking existing functionality.

**Environment parity principle enforced:** Dev and prod will have identical code AND rules - no configuration differences that could cause deployment surprises.

**Priority: CRITICAL** - This work should begin immediately.