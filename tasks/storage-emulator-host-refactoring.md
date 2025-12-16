# Storage URL Generation Refactoring

## Problem

The `storageEmulatorHost` should not be directly used within storage classes. This creates tight coupling to the Firebase emulator environment and prevents proper abstraction of dependencies.

## Objective

Refactor storage classes to use an explicit `storagePublicBaseUrl` parameter instead of `storageEmulatorHost`, improving testability and flexibility across different environments (local emulator, staging, production).

## Research

- `TenantAssetStorage.ts` and `CloudThemeArtifactStorage.ts` both built URLs directly from a `storageEmulatorHost` value (defaulting to `process.env.FIREBASE_STORAGE_EMULATOR_HOST`). URL generation was coupled to that host string.
- `ComponentBuilder` constructs storage instances with config from `ServiceConfig`.
- Both classes used singleton factory patterns with complex signature overloading to support legacy and new config styles.

## Solution

Replace `storageEmulatorHost: string | null` with `storagePublicBaseUrl: string`:
- Emulator: `http://localhost:9199`
- Production: `https://firebasestorage.googleapis.com`

This eliminates conditional logic and environment variable fallbacks - the URL base is always explicitly provided.

## Changes Made

### ServiceConfig
- Renamed `storageEmulatorHost` to `storagePublicBaseUrl`
- Now always provides a complete base URL (emulator: `http://${FIREBASE_STORAGE_EMULATOR_HOST}`, prod: `https://firebasestorage.googleapis.com`)

### TenantAssetStorage
- Removed singleton factory pattern (`createTenantAssetStorage`, `resetTenantAssetStorage`)
- `CloudTenantAssetStorage` now takes explicit `storagePublicBaseUrl: string` parameter
- Removed environment variable fallback
- Simplified URL generation to simple string concatenation

### CloudThemeArtifactStorage
- Same refactoring as TenantAssetStorage
- Takes explicit `storagePublicBaseUrl: string` parameter
- Removed conditional emulator/prod URL logic

### ThemeArtifactStorage.ts
- Removed singleton factory pattern (`createThemeArtifactStorage`, `resetThemeArtifactStorage`)
- Now only exports interfaces and `computeSha256` utility

### ComponentBuilder
- Creates both storage classes directly with `this.serviceConfig.storagePublicBaseUrl`

### Tests
- All tests now instantiate storage classes directly with explicit base URLs
- Removed `resetThemeArtifactStorage()` and `resetTenantAssetStorage()` calls
- Test naming updated to reflect "base URL" terminology

## Impact

- Improved testability - no singleton state to reset between tests
- Better separation of concerns - URL formatting decoupled from business logic
- Consistent pattern across both storage classes
- No environment variable access inside storage classes
