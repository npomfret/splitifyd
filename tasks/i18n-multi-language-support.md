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

### Phase 1: Infrastructure Prep - COMPLETED

**Task 1.1: Fix date/time formatting** ✅
- File: `webapp-v2/src/utils/dateUtils.ts`
- Added `getLocale()` helper that reads from i18n
- Updated `formatLocalDateTime()` to use dynamic locale
- Updated `formatExpenseDateTime()` to use `Intl.DateTimeFormat` with locale
- Updated `formatDistanceToNow()` to use i18n translation keys

**Task 1.2: Fix currency formatting** ✅
- File: `webapp-v2/src/utils/currency/currencyFormatter.ts`
- Added `getDefaultLocale()` helper
- Updated both `formatCurrency()` and `formatCurrencyParts()` to use dynamic default

**Task 1.3: Standardize pluralization** ✅
- File: `webapp-v2/src/locales/en/translation.json`
- Converted `members_plural` → `members_one` / `members_other`
- Converted `expenses_plural` → `expenses_one` / `expenses_other`

**Task 1.4: Add relative time translation keys** ✅
- File: `webapp-v2/src/locales/en/translation.json`
- Added `relativeTime` section with `justNow`, `minuteAgo_one/_other`, etc.

**Task 1.5: Create language detection** ✅
- New file: `webapp-v2/src/utils/languageDetection.ts`
- Exports: `detectBrowserLanguage()`, `persistLanguageChoice()`, `getIntlLocale()`
- Exports: `SUPPORTED_LANGUAGES`, `SupportedLanguage` type
- Additional exports deferred to Phase 2: `LANGUAGE_NAMES`, `getPersistedLanguage()`, `clearPersistedLanguage()`

**Task 1.6: Configure i18n for language detection** ✅
- File: `webapp-v2/src/i18n.ts`
- Uses detected language on initialization
- Configured `supportedLngs` array
- Dynamic loading and switching functions deferred to Phase 2

### Phase 2: Language Switching UI

**Task 2.1: Export Phase 2 utilities from languageDetection.ts**
- Export `LANGUAGE_NAMES`, `getPersistedLanguage()`, `clearPersistedLanguage()`

**Task 2.2: Add language switching to i18n.ts**
- `loadLanguageBundle()` - dynamic import of translation files
- `changeLanguage()` - load bundle + switch + persist
- `applyUserLanguagePreference()` - apply user's profile preference after auth

**Task 2.3: Create LanguageSwitcher component**
- New file: `webapp-v2/src/components/ui/LanguageSwitcher.tsx`
- Two variants: `compact` (header) and `full` (settings page)
- Compact: shows language code, dropdown on click
- Full: uses existing Select component with label

**Task 2.4: Add LanguageSwitcher to Header**
- File: `webapp-v2/src/components/layout/Header.tsx`
- Add to auth section (right side, before Login/Sign Up)
- Shows on: Login, Register, Reset Password pages

**Task 2.5: Add Language section to Settings page**
- File: `webapp-v2/src/pages/SettingsPage.tsx`
- New Card section after Password section
- On change: call `changeLanguage()` + update user profile via API

**Task 2.6: Integrate with auth-store**
- File: `webapp-v2/src/app/stores/auth-store.ts`
- On login success: apply user's `preferredLanguage` if set

**Task 2.7: Add translation keys**
- Add `languageSelector` section to translation.json

**Task 2.8: Extend UpdateUserProfileRequest**
- File: `packages/shared/src/shared-types.ts`
- Add `preferredLanguage?: string` to `UpdateUserProfileRequest`
- Ensure backend handler saves the field

### Phase 2.5: Tenant Language Pass-through

Tenants embedding our app may already have language support on their site. We should accept a language hint from them.

**Options to explore:**
1. **URL parameter** - `?lang=uk` or `?locale=uk-UA` on initial load
2. **Embed config** - If we have an embed/widget mode, accept language in config
3. **PostMessage API** - Parent frame can send language preference
4. **Cookie** - Read a tenant-set cookie (e.g., `preferred_language`)

**Detection priority (updated):**
1. User's `preferredLanguage` from profile (authenticated)
2. localStorage (returning visitor)
3. **Tenant-provided language hint** (URL param, embed config, etc.)
4. `navigator.language` / `navigator.languages` (browser preference)
5. `'en'` fallback

**Implementation notes:**
- URL param should be read once on initial load, not on every navigation
- Should validate against `SUPPORTED_LANGUAGES` before applying
- Consider persisting tenant hint to localStorage so it survives page refreshes

### Phase 3: Add Ukrainian

- Create `webapp-v2/src/locales/uk/translation.json`
- Register 'uk' as supported language
- Validate with native speaker

### Phase 4: Test Infrastructure

- Extend `packages/test-support/src/translations/` for multi-language

## Key Files

### Phase 1 (Complete)

| File | Change |
|------|--------|
| `webapp-v2/src/i18n.ts` | Use detected language on init, configure supportedLngs |
| `webapp-v2/src/utils/dateUtils.ts` | Locale parameter, i18n for relative time |
| `webapp-v2/src/utils/currency/currencyFormatter.ts` | Locale parameter |
| `webapp-v2/src/locales/en/translation.json` | Add `relativeTime` keys, fix plurals |
| `webapp-v2/src/utils/languageDetection.ts` | New - browser detection, locale mapping |

### Phase 2 (Pending)

| File | Change |
|------|--------|
| `webapp-v2/src/utils/languageDetection.ts` | Export `LANGUAGE_NAMES`, `getPersistedLanguage()`, `clearPersistedLanguage()` |
| `webapp-v2/src/i18n.ts` | Add `loadLanguageBundle()`, `changeLanguage()`, `applyUserLanguagePreference()` |
| `webapp-v2/src/components/ui/LanguageSwitcher.tsx` | **New** - compact (header) + full (settings) variants |
| `webapp-v2/src/components/layout/Header.tsx` | Add LanguageSwitcher to auth section |
| `webapp-v2/src/pages/SettingsPage.tsx` | Add Language preferences section |
| `webapp-v2/src/app/stores/auth-store.ts` | Apply user preference on login |
| `webapp-v2/src/locales/en/translation.json` | Add `languageSelector` keys |
| `packages/shared/src/shared-types.ts` | Add `preferredLanguage` to `UpdateUserProfileRequest` |
| `firebase/functions/src/users/handlers.ts` | Handle `preferredLanguage` in updateProfile |

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
