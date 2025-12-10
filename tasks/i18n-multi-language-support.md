# i18n Multi-Language Support

## Goal

Prepare the codebase for adding Ukrainian (uk) as the first non-English language.

## Research Summary

### Current State

| Area | Status |
|------|--------|
| i18next setup | Complete - `webapp-v2/src/i18n.ts` |
| Translation file | 2,308 lines in `webapp-v2/src/locales/en/translation.json` |
| Missing key detection | Working - logs errors for untranslated keys |
| Backend error codes | Ready - clients translate codes via `apiErrors` namespace |
| User preference field | Exists - `preferredLanguage?: string` on `ClientUser` |

### Issues Blocking Multi-Language

1. **Hardcoded locales in formatters**
   - `webapp-v2/src/utils/dateUtils.ts` - hardcoded `'en-CA'`, `'en-GB'`
   - `webapp-v2/src/utils/currency/currencyFormatter.ts` - hardcoded `'en-US'`

2. **Hardcoded English strings**
   - `formatDistanceToNow()` returns `"just now"`, `"X minutes ago"`, etc.
   - `formatExpenseDateTime()` uses `'en-US'` for month names

3. **Inconsistent pluralization**
   - Some keys use old `_plural` suffix
   - i18next v21+ requires `_one` / `_other` format

4. **No language infrastructure**
   - Static English import only
   - No language detection
   - No language switching UI

### Ukrainian-Specific Requirements

- Cyrillic script (verify font support)
- 4 plural forms: `_one`, `_few`, `_many`, `_other`
- Example: 1 учасник, 2 учасники, 5 учасників, 1.5 учасника

## User Decisions

- First language: Ukrainian (uk)
- Language switcher location: Settings page only
- Tenant language defaults: No (user preference only)

## Implementation Plan

### Phase 1: Infrastructure Prep

**Task 1.1: Fix date/time formatting**
- File: `webapp-v2/src/utils/dateUtils.ts`
- Add locale parameter to formatting functions
- Use `Intl.DateTimeFormat` with dynamic locale for month names
- Add translation keys for relative time strings

**Task 1.2: Fix currency formatting**
- File: `webapp-v2/src/utils/currency/currencyFormatter.ts`
- Add locale parameter (default from i18n)

**Task 1.3: Standardize pluralization**
- File: `webapp-v2/src/locales/en/translation.json`
- Convert `_plural` keys to `_one` / `_other` format

**Task 1.4: Add relative time translation keys**
- File: `webapp-v2/src/locales/en/translation.json`
- Add `relativeTime.minuteAgo_one`, `_other`, etc.

**Task 1.5: Create language detection**
- New file: `webapp-v2/src/utils/languageDetection.ts`
- Priority: user profile > localStorage > navigator.language > 'en'

**Task 1.6: Add dynamic language loading**
- File: `webapp-v2/src/i18n.ts`
- Lazy load additional language bundles

### Phase 2: Language Switching UI

- Add language selector to settings page
- Integrate with user profile `preferredLanguage`
- localStorage persistence for anonymous users
- Apply detected language on app load

### Phase 3: Add Ukrainian

- Create `webapp-v2/src/locales/uk/translation.json`
- Register 'uk' as supported language
- Validate with native speaker

### Phase 4: Test Infrastructure

- Extend `packages/test-support/src/translations/` for multi-language

## Key Files

| File | Change |
|------|--------|
| `webapp-v2/src/i18n.ts` | Dynamic language loading |
| `webapp-v2/src/utils/dateUtils.ts` | Locale parameter, i18n for relative time |
| `webapp-v2/src/utils/currency/currencyFormatter.ts` | Locale parameter |
| `webapp-v2/src/locales/en/translation.json` | Add `relativeTime` keys, fix plurals |
| `webapp-v2/src/utils/languageDetection.ts` | New - detection logic |
| `webapp-v2/src/components/settings/LanguageSelector.tsx` | New - UI component |

## Language Detection Strategy

For first-time visitors:
```typescript
const detectLanguage = (): string => {
  // 1. localStorage (returning visitor)
  const stored = localStorage.getItem('language');
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  // 2. Browser preference
  const browserLang = navigator.language?.split('-')[0];
  if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;

  // 3. navigator.languages fallback
  for (const lang of navigator.languages || []) {
    const code = lang.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(code)) return code;
  }

  return 'en';
};
```

For authenticated users, `preferredLanguage` from profile takes priority.
