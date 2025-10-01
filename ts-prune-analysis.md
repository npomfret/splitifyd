# ts-prune Analysis Results

## 🔍 Investigation Summary

After thorough investigation, **ts-prune is producing extensive false positives** due to path alias resolution issues in the TypeScript configuration.

### ❌ The Problem

ts-prune cannot properly resolve the `@/*` path aliases defined in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

This means imports like `import { getInitials } from '@/utils/avatar.ts'` are not being tracked properly, causing ts-prune to incorrectly flag these exports as unused.

### ✅ Verified False Positives

I manually verified that the following "unused" exports are **actually being used**:

#### Date Utilities (ALL USED):
- `getUTCMidnight` - used in SettlementForm.tsx
- `getUTCDateTime` - used in expense-form-store.ts
- `extractTimeFromISO` - used in useFormInitialization.ts
- `isDateInFuture` - used in expense-form-store.ts and SettlementForm.tsx
- `getToday`, `getYesterday`, `getThisMorning`, `getLastNight` - used in ExpenseBasicFields.tsx

#### Avatar Utilities (ALL USED):
- `getInitials` - used in Avatar.tsx and CommentItem.tsx
- `getAvatarSize` - used in Avatar.tsx
- `getContrastColor` - used in Avatar.tsx

#### Time Parser Functions (ALL USED):
- `formatTime24`, `generateTimeSuggestions`, `filterTimeSuggestions` - used in TimeInput.tsx

#### Constants (ALL USED):
- `USER_ID_KEY` - used in auth-store.ts

#### Hooks (ALL USED):
- `useConfig` - used in WarningBanner.tsx
- `usePolicy` - used in privacy/terms/cookie policy pages
- `useDebounce` - used in CurrencySelector.tsx and useCurrencySelector.ts

## 📊 Actual ts-prune Results vs Reality

| Item | ts-prune Says | Reality | Reason |
|------|---------------|---------|---------|
| Date utils | Unused | **Used** | Path alias not resolved |
| Avatar utils | Unused | **Used** | Path alias not resolved |
| Time parser | Unused | **Used** | Path alias not resolved |
| Constants | Unused | **Used** | Path alias not resolved |
| Hooks | Unused | **Used** | Path alias not resolved |

## 🛠️ Workarounds Attempted

1. **Different tsconfig**: ts-prune still can't resolve path aliases
2. **Direct file scanning**: Manual grep confirms extensive usage
3. **Alternative tools**: Could try `unimported` or `knip` instead

## 💡 Recommendations

### 1. Short-term: Manual Analysis
- Use grep/search to verify before removing any exports
- Focus on component index files that might be over-exported
- Check for components imported directly vs. through index

### 2. Long-term: Better Tools
Consider switching to [`knip`](https://knip.dev/) which:
- Handles modern TypeScript configurations better
- Supports path aliases properly
- Provides more accurate unused code detection
- Is actively maintained (ts-prune is in maintenance mode)

### 3. Alternative Approach: Component Audit
Instead of relying on ts-prune, manually audit:
- Component index exports vs. actual usage
- Schema exports that might be over-exported
- Test utilities that aren't used in CI

## 🎯 Safe Cleanup Strategy

1. **Component Index Review**: Check which components are imported via index vs. direct imports
2. **Schema Over-exports**: Many Zod schemas marked "used internally" could be moved to internal scope
3. **Test Utility Cleanup**: Remove unused test builders and utilities
4. **Type Consolidation**: Continue the work already done on type cleanup

## 📝 Conclusion

The high unused export count (602) from ts-prune is misleading due to path alias resolution issues. The actual number of genuinely unused exports is likely much lower.

**Recommendation**: Don't remove the "high priority" items identified initially, as they are all false positives. Focus on manual review of component exports and schema organization instead.