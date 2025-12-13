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

### Phase 2: Language Switching UI - COMPLETED

**Task 2.1: Export Phase 2 utilities from languageDetection.ts** ✅
- Exported `LANGUAGE_NAMES`, `getPersistedLanguage()`, `clearPersistedLanguage()`

**Task 2.2: Add language switching to i18n.ts** ✅
- Added `loadLanguageBundle()` - dynamic import of translation files
- Added `changeLanguage()` - load bundle + switch + persist
- Added `applyUserLanguagePreference()` - apply user's profile preference after auth

**Task 2.3: Create LanguageSwitcher component** ✅
- New file: `webapp-v2/src/components/ui/LanguageSwitcher.tsx`
- Two variants: `compact` (header) and `full` (settings page)
- Compact: shows uppercase language code (EN/UK), dropdown on click
- Full: uses existing Select component (no label/description - added by parent)

**Task 2.4: Add LanguageSwitcher to Header** ✅
- File: `webapp-v2/src/components/layout/Header.tsx`
- Added to auth section (right side, before Login/Sign Up buttons)
- Shows on: Login, Register, Reset Password pages

**Task 2.5: Add Language section to Settings page** ✅
- File: `webapp-v2/src/pages/SettingsPage.tsx`
- New Card section after Password section
- Uses LanguageSwitcher full variant

**Task 2.6: Integrate with auth-store** ✅
- File: `webapp-v2/src/app/stores/auth-store.ts`
- On login success: apply user's `preferredLanguage` if set via `applyUserLanguagePreference()`

**Task 2.7: Add translation keys** ✅
- Added `languageSelector` section with `label` and `description` keys

**Task 2.8: Extend UpdateUserProfileRequest** ✅
- Added `preferredLanguage?: string` to `UpdateUserProfileRequest` in shared-types.ts
- Added `preferredLanguage?: string` to `UserProfileResponse` in shared-types.ts
- Updated schema validation in `apiRequests.ts` to accept `'en'`, `'uk'`, or `'ar'`
- Backend already handled `preferredLanguage` in UserService2.updateProfile()
- Updated `_getProfile()` to return `preferredLanguage`
- LanguageSwitcher full variant saves to user profile via API

### Phase 2.5: Tenant Language Pass-through - COMPLETED

**Task 2.5.1: Add URL parameter detection** ✅
- File: `webapp-v2/src/utils/languageDetection.ts`
- Added `?lang=uk` URL parameter check in `detectBrowserLanguage()`
- Validates against `SUPPORTED_LANGUAGES`
- Persists to localStorage on first read (survives navigation)

**Detection priority (final):**
1. User's `preferredLanguage` from profile (authenticated) - handled by auth-store
2. localStorage (returning visitor or previously applied URL param)
3. URL parameter `?lang=uk` (tenant pass-through)
4. `navigator.language` / `navigator.languages` (browser preference)
5. `'en'` fallback

**Future options (not implemented):**
- PostMessage API for iframe embeds
- Cookie-based detection
- Embed config for widget mode

### Phase 3: Add Ukrainian, Arabic, and German - COMPLETED

**Ukrainian (uk):** ✅
- Created `webapp-v2/src/locales/uk/translation.json`
- Registered 'uk' as supported language
- LTR language - no RTL infrastructure needed

**Arabic (ar):** ✅
- Created `webapp-v2/src/locales/ar/translation.json` (1,550 keys)
- Registered 'ar' as supported language with locale mapping `ar-SA`
- RTL language - required RTL infrastructure (see `tasks/rtl-internationalization-deep-dive.md`)
- All RTL support implemented:
  - `dir` attribute switching in App.tsx
  - Text alignment classes migrated (`text-start`/`text-end`)
  - Position classes migrated (`start-*`/`end-*`)
  - Directional icons flip with `rtl:-scale-x-100`

**German (de):** ✅
- Created `webapp-v2/src/locales/de/translation.json` (~1,930 lines)
- Registered 'de' as supported language with locale mapping `de-DE`
- LTR language - no special infrastructure needed

### Phase 3b: Additional Languages - COMPLETED

**Spanish (es):** ✅
- Created `webapp-v2/src/locales/es/translation.json`
- Registered 'es' as supported language with locale mapping `es-ES`

**Italian (it):** ✅
- Created `webapp-v2/src/locales/it/translation.json`
- Registered 'it' as supported language with locale mapping `it-IT`

**Japanese (ja):** ✅
- Created `webapp-v2/src/locales/ja/translation.json`
- Registered 'ja' as supported language with locale mapping `ja-JP`

**Korean (ko):** ✅
- Created `webapp-v2/src/locales/ko/translation.json`
- Registered 'ko' as supported language with locale mapping `ko-KR`

**Latvian (lv):** ✅
- Created `webapp-v2/src/locales/lv/translation.json`
- Registered 'lv' as supported language with locale mapping `lv-LV`

**Filipino (ph):** ✅
- Created `webapp-v2/src/locales/ph/translation.json`
- Registered 'ph' as supported language with locale mapping `fil-PH`

**Swedish (sv):** ✅
- Created `webapp-v2/src/locales/sv/translation.json`
- Registered 'sv' as supported language with locale mapping `sv-SE`

### Phase 4: Test Infrastructure - COMPLETED

**Task 4.1: Add language switching methods to SettingsPage page object** ✅
- File: `packages/test-support/src/page-objects/SettingsPage.ts`
- Added `getLanguageSelect()` protected locator
- Added `selectLanguage(languageCode)` action method
- Added `verifyLanguageSectionVisible()` verification
- Added `verifyLanguageSelected(languageCode)` verification
- Added `verifyLanguageSectionHeadingText(text)` for i18n UI verification

**Task 4.2: Add language switching UI tests** ✅
- File: `webapp-v2/src/__tests__/integration/playwright/language-switching.test.ts`
- Test: Language section visible on settings page
- Test: Switch from English to Arabic, verify UI text and RTL direction
- Test: Switch back from Arabic to English, verify UI text and LTR direction

## Key Files

### Phase 1 (Complete)

| File | Change |
|------|--------|
| `webapp-v2/src/i18n.ts` | Use detected language on init, configure supportedLngs |
| `webapp-v2/src/utils/dateUtils.ts` | Locale parameter, i18n for relative time |
| `webapp-v2/src/utils/currency/currencyFormatter.ts` | Locale parameter |
| `webapp-v2/src/locales/en/translation.json` | Add `relativeTime` keys, fix plurals |
| `webapp-v2/src/utils/languageDetection.ts` | New - browser detection, locale mapping |

### Phase 2 (Complete)

| File | Change |
|------|--------|
| `webapp-v2/src/utils/languageDetection.ts` | ✅ Exported `LANGUAGE_NAMES`, `getPersistedLanguage()`, `clearPersistedLanguage()` |
| `webapp-v2/src/i18n.ts` | ✅ Added `loadLanguageBundle()`, `changeLanguage()`, `applyUserLanguagePreference()` |
| `webapp-v2/src/components/ui/LanguageSwitcher.tsx` | ✅ **New** - compact (header) + full (settings) variants |
| `webapp-v2/src/components/layout/Header.tsx` | ✅ Added LanguageSwitcher to auth section |
| `webapp-v2/src/pages/SettingsPage.tsx` | ✅ Added Language preferences section |
| `webapp-v2/src/app/stores/auth-store.ts` | ✅ Apply user preference on login |
| `webapp-v2/src/locales/en/translation.json` | ✅ Added `languageSelector` keys |
| `packages/shared/src/shared-types.ts` | ✅ Added `preferredLanguage` to `UpdateUserProfileRequest` and `UserProfileResponse` |
| `packages/shared/src/schemas/apiRequests.ts` | ✅ Updated validation to accept 'en' or 'uk' |
| `firebase/functions/src/user/validation.ts` | ✅ Updated error message for language validation |
| `firebase/functions/src/services/UserService2.ts` | ✅ Updated `_getProfile()` to return `preferredLanguage` |

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
