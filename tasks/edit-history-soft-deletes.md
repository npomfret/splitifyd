# Edit History via Soft Deletes

Expense edits (and other entity edits) currently overwrite the previous data. This loses the edit history.

**Problem:** No audit trail of changes - can't see what an expense looked like before it was edited.

**Proposal:** Model edits as soft deletes of the old version + creation of a new version, preserving full history.

**Scope:** Expenses, settlements, and potentially other editable entities.
