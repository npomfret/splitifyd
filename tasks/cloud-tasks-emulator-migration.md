# Migrate to Firebase Cloud Tasks Emulator

## Background

As of August 2024, the Firebase Emulator Suite now includes Cloud Tasks emulation ([PR #7475](https://github.com/firebase/firebase-tools/pull/7475)). Previously, Cloud Tasks was not supported ([Issue #4884](https://github.com/firebase/firebase-tools/issues/4884)), which is why we created `StubCloudTasksClient` in `@billsplit-wl/firebase-simulator`.

## Current Architecture

```
ICloudTasksClient (interface)
├── CloudTasksClientWrapper - wraps real @google-cloud/tasks for production
└── StubCloudTasksClient - in-memory stub for testing
```

**Files:**
- `packages/firebase-simulator/src/cloudtasks-types.ts` - interface definition
- `packages/firebase-simulator/src/admin-cloudtasks.ts` - production wrapper
- `packages/firebase-simulator/src/StubCloudTasksClient.ts` - test stub
- `firebase/functions/src/services/ComponentBuilder.ts` - creates client
- `firebase/functions/src/merge/MergeService.ts` - main consumer

**Current Usage:**
- `MergeService` uses Cloud Tasks to enqueue async merge jobs
- Tasks call back to `/processMerge` endpoint
- In unit tests, `StubCloudTasksClient` captures enqueued tasks for assertions

## Why Migrate?

1. **Real behavior in emulator** - tasks actually execute with proper timing/retry
2. **End-to-end testing** - can test full task lifecycle without mocking
3. **Reduced maintenance** - less custom code to maintain
4. **Consistency** - same behavior in emulator as production

## Recommended Approach

### Keep Both Implementations

| Context | Implementation | Reason |
|---------|---------------|--------|
| Unit tests | `StubCloudTasksClient` | Fast, inspectable, no emulator needed |
| Emulator runtime | Real Cloud Tasks emulator | Actual task execution and timing |
| Production | `CloudTasksClientWrapper` | Real GCP Cloud Tasks |

### Implementation Steps

1. **Enable Cloud Tasks in emulator config**
   - Update `firebase.json` to include tasks emulator
   - Configure tasks emulator port in `instances.json`

2. **Update ComponentBuilder**
   - Detect if tasks emulator is running
   - Use real client when emulator available, stub otherwise

3. **Update environment handling**
   - `__CLOUD_TASKS_LOCATION` only required when tasks emulator NOT available
   - When tasks emulator runs, it provides the location automatically

4. **Test task execution in emulator**
   - Verify tasks are enqueued and executed
   - Check `/processMerge` endpoint receives callbacks

### Environment Variable Changes

After migration:
- `__CLOUD_TASKS_LOCATION` - only needed in `.env.firebase.example` (staging/prod)
- Dev instances can omit it if using tasks emulator

## Open Questions

1. **Tasks emulator port** - need to add to `instances.json` port mappings
2. **OIDC tokens** - does emulator validate them or skip?
3. **Queue creation** - does emulator auto-create queues or need config?

## References

- [Firebase Cloud Tasks Emulator PR](https://github.com/firebase/firebase-tools/pull/7475)
- [Firebase Task Functions Docs](https://firebase.google.com/docs/functions/task-functions)
- [Run functions locally](https://firebase.google.com/docs/functions/local-emulator)
