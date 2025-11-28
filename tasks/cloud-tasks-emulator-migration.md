# Cloud Tasks Emulator Support

## Status: IMPLEMENTED

As of August 2024, Firebase Emulator Suite includes Cloud Tasks emulation ([PR #7475](https://github.com/firebase/firebase-tools/pull/7475)).

## What Was Done

1. **Added tasks emulator port configuration**
   - `firebase/scripts/instances-config.ts` - added `tasks` to `InstancePorts` interface
   - `firebase/instances.json` - added `tasks` port for each instance (6007, 7007, 8007, 9007)

2. **Updated firebase config template**
   - `firebase/firebase.template.json` - added `tasks` emulator section

3. **Updated config generator**
   - `firebase/scripts/generate-firebase-config.ts` - added `EMULATOR_TASKS_PORT` replacement

## How It Works

The `@google-cloud/tasks` SDK automatically detects `CLOUD_TASKS_EMULATOR_HOST` environment variable when the Firebase tasks emulator is running. No code changes were needed in `ComponentBuilder` or `MergeService` - they already use the real SDK via `createCloudTasksClient()`.

When the emulator starts:
1. Tasks emulator runs on configured port (e.g., 6007 for dev1)
2. Firebase sets `CLOUD_TASKS_EMULATOR_HOST=localhost:6007`
3. `@google-cloud/tasks` SDK routes requests to emulator instead of GCP

## StubCloudTasksClient

`StubCloudTasksClient` in `@billsplit-wl/firebase-simulator` is still used for **unit tests** where we don't run the emulator. This provides:
- Fast test execution (no emulator startup)
- Ability to inspect enqueued tasks
- Deterministic test behavior

## Testing

After restarting dev environment (`./dev1.sh`), verify tasks emulator starts:
```
✔  tasks: Tasks Emulator at 127.0.0.1:6007
```

## References

- [Firebase Cloud Tasks Emulator PR](https://github.com/firebase/firebase-tools/pull/7475)
- [Firebase Task Functions Docs](https://firebase.google.com/docs/functions/task-functions)
