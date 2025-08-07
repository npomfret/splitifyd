# Firebase Scripts

This directory contains utility scripts for Firebase Functions development and maintenance.

## seed-policies.ts

Seeds the initial policy documents (Terms of Service, Cookie Policy, Privacy Policy) into the Firestore emulator.

### Usage

```bash
# From the firebase/functions directory
npm run seed:policies
```

### What it does

1. Connects to the local Firestore emulator (port 8480)
2. Creates three policy documents with comprehensive legal text:
   - Terms of Service (`terms-of-service`)
   - Cookie Policy (`cookie-policy`)  
   - Privacy Policy (`privacy-policy`)
3. Each policy includes:
   - SHA-256 hash-based versioning
   - Markdown-formatted text
   - Creation timestamps
   - System metadata

### When to run

Run this script when:
- Setting up a new development environment
- After clearing the Firestore emulator data
- Testing the policy acceptance flow
- The app fails with "Registration temporarily unavailable" errors

### Requirements

- Firebase emulator must be running (`npm run dev` from project root)
- Script automatically reads emulator ports from `firebase.json`
- Falls back to default ports if configuration cannot be read

### Verification

After running, verify policies are available:

```bash
# Check all current policies
curl http://localhost:6002/api/policies/current | python3 -m json.tool

# Get specific policy text
curl http://localhost:6002/api/policies/terms-of-service/current | python3 -m json.tool
```

### Notes

- The script uses the project ID `splitifyd` by default
- Policies are created with production-ready legal text
- Each policy gets a unique SHA-256 hash based on its content
- The registration flow requires these policies to exist