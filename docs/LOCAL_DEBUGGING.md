# Local Firebase Debugging Guide

## Where to Find Logs When Running Locally

### 1. **Console Output (Primary)**
- **Location**: Terminal window where `npm run dev` or `firebase emulators:start` is running
- **Content**: All `console.log()`, `console.error()`, `console.warn()`, and `console.info()` output from Functions
- **Best for**: Real-time debugging, error messages, flow tracking

### 2. **Firebase Functions Logs**
- **Command**: `npm run logs` or `firebase functions:log`
- **Content**: Structured logs using `functions.logger` and request/response logs
- **Format**: JSON with timestamps, correlation IDs, and structured data
- **Best for**: Production-like logging, structured data analysis

### 3. **Debug Log Files**
Located in the Firebase project root (same directory as `firebase.json`):
- `firestore-debug.log` - Firestore emulator logs
- `firebase-debug.log` - General Firebase CLI debug info
- `ui-debug.log` - Emulator UI logs

### 4. **Enhanced Debug Mode**
- **Command**: `firebase emulators:start --debug`
- **Effect**: Shows additional debug information in console output
- **Use when**: Troubleshooting emulator startup issues

### 5. **Emulator UI**
- **URL**: http://localhost:4000 (when emulators are running)
- **Content**: Visual logs, function execution details, database state
- **Best for**: Visual debugging, testing different scenarios

## Common Issues and Solutions

### Issue: console.log() Not Showing in Terminal
- **Cause**: Functions emulator may need restart after code changes
- **Solution**: Restart emulators with `npm run dev` or rebuild with `npm run build`

### Issue: Error Details Missing
- **Cause**: Using only `functions.logger` which may not show in terminal
- **Solution**: Add `console.error()` statements for immediate visibility

### Issue: Logs Not Updating
- **Cause**: Functions not rebuilding after TypeScript changes
- **Solution**: Run `cd functions && npm run build` then restart emulators

## Best Practices for Local Debugging

1. **Use Both Logging Methods**:
   ```typescript
   console.error('❌ Error occurred:', error.message);
   logger.errorWithContext('Error occurred', error, { context });
   ```

2. **Add Detailed Console Logging**:
   ```typescript
   console.log('🔄 Starting operation...');
   console.log('✅ Operation completed');
   console.error('❌ Operation failed:', error);
   ```

3. **Use Correlation IDs**:
   - Every request gets a unique correlation ID
   - Helps track requests across logs
   - Added automatically by middleware

4. **Check Terminal Output First**:
   - Fastest way to see what's happening
   - Shows console.log/error output immediately
   - Look for emojis to quickly identify log types

5. **Use Structured Logs for Analysis**:
   - Use `functions.logger` for production-ready logging
   - Include context data for better debugging
   - Can be viewed with `npm run logs`

## Debugging the Register 500 Error (Example)

The register endpoint was failing with a 500 error. Here's what we did:

1. **Added Console Logging**: Enhanced register handler with detailed console.log/error statements
2. **Fixed Admin SDK**: Configured Firebase Admin to connect to local Auth emulator
3. **Added Connection Test**: Tested Auth emulator connection on startup
4. **Enhanced Error Details**: Added error codes, messages, and stack traces

Result: Could see exactly where the failure occurred and what the root cause was.