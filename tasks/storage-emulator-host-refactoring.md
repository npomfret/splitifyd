# TenantAssetStorage.ts Refactoring

## Problem

The `storageEmulatorHost` should not be directly used within `TenantAssetStorage.ts`. This creates a tight coupling to the Firebase emulator environment and prevents proper abstraction of dependencies.

## Objective

Refactor `TenantAssetStorage.ts` to properly abstract its dependencies, particularly regarding the storage emulator host, to improve testability and flexibility across different environments (local emulator, staging, production).

## Research Needed

- Review `TenantAssetStorage.ts` to identify all instances and usages of `storageEmulatorHost`.
- Understand how `storageEmulatorHost` is currently being injected or accessed.
- Investigate patterns for abstracting environment-specific configurations or client initializations.

## Technical Considerations

- **Dependency Injection**: How can the storage client be provided to `TenantAssetStorage` in a testable way?
- **Configuration**: How to pass environment-specific configuration (like emulator host) without hardcoding?
- **Testing**: Ensure the refactoring improves or maintains the ability to unit test `TenantAssetStorage` without relying on a running emulator.

## Implementation Plan

TBD - needs further research into the current implementation of `TenantAssetStorage.ts`.

## Impact

- Improved testability of `TenantAssetStorage`.
- Better separation of concerns between business logic and infrastructure.
- Increased flexibility for deployment to various environments.
