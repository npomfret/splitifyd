# Schema Migrations

Use the **Expand/Contract** pattern for all Firestore schema changes.

---

## The Pattern

### Phase 1: Expand
- Add new field/structure alongside old
- Code **reads** new field, falls back to old
- Code **writes both** old and new fields
- Deploy

### Phase 2: Migrate
- Run batch migration script to backfill new field on all documents
- Verify data integrity

### Phase 3: Contract
- Remove fallback read logic
- Stop writing old field
- Deploy
- Run cleanup script to remove old fields from documents

---

## Example: Renaming `amount` to `amountCents`

### Phase 1: Expand

```typescript
// FirestoreWriter - writes both
{
  amount: expense.amountCents / 100,    // old (deprecated)
  amountCents: expense.amountCents,     // new
}

// FirestoreReader - reads new, falls back to old
const amountCents = doc.amountCents ?? Math.round(doc.amount * 100);
```

### Phase 2: Migrate

```bash
npm run migrate:expenses:amount-to-cents
```

### Phase 3: Contract

```typescript
// FirestoreWriter - only new
{
  amountCents: expense.amountCents,
}

// FirestoreReader - only new
const amountCents = doc.amountCents;
```

---

## Rules

1. **Never skip phases** - each phase is a separate deployment
2. **Backups before Phase 2** - snapshot collection before running migration
3. **Test migrations** - copy production data to staging, run migration, verify
4. **Complete Phase 3** - don't leave compat code forever; track in task files

---

## Tracking Migrations

Create a task file for each migration:

```
tasks/migrate-expense-amount-to-cents.md
```

Track:
- Which phase you're in
- When each phase was deployed
- Verification status
