# Declutter Explainer Text with Info Icons

Replace inline help/explainer text with `InfoCircleIcon` + `Tooltip` pattern to declutter UI.

**Reference implementation:** `webapp-v2/src/components/group/settings/security/CustomPermissionsSection.tsx`

**Status:** COMPLETED

---

## Completed

### UI Components Updated

#### CreateGroupModal.tsx
- [x] Group name help text → info icon
- [x] Group display name help text → info icon
- [x] Group description help text → info icon

#### SettingsPage.tsx
- [x] Profile information section description → info icon next to heading
- [x] Display name helper text → info icon next to label
- [x] Email section description → info icon next to heading
- [x] Password section intro text → info icon next to heading
- [x] Language selector description → info icon next to heading

#### GroupCurrencySettings.tsx
- [x] Currency settings section description → info icon next to title

#### JoinGroupPage.tsx
- [x] Display name purpose description → info icon next to label

### Translation Updates

#### All Languages
- [x] Added `common.moreInfo` key with proper translations:
  - EN: "More information"
  - DE: "Mehr Informationen"
  - AR: "مزيد من المعلومات"
  - ES: "Más información"
  - IT: "Ulteriori informazioni"
  - JA: "詳細情報"
  - KO: "자세한 정보"
  - LV: "Vairāk informācijas"
  - NL-BE: "Meer informatie"
  - NO: "Mer informasjon"
  - PH: "Higit pang impormasyon"
  - SV: "Mer information"
  - UK: "Більше інформації"

#### "(optional)" Removed from Labels
- [x] EN, DE, ES, IT, NO, SV: groupDescriptionLabel, noteLabel, descriptionLabel

### Page Object Models Updated

#### SettingsPage.ts
- [x] `getDisplayNameHelperText()` → `getDisplayNameInfoIcon()`
- [x] `getProfileInformationDescription()` → `getProfileInformationInfoIcon()`
- [x] `getPasswordDescription()` → `getPasswordInfoIcon()`
- [x] `verifyDisplayNameHelperTextVisible()` → `verifyDisplayNameInfoIconVisible()`
- [x] `verifyProfileInformationDescriptionVisible()` → `verifyProfileInformationInfoIconVisible()`
- [x] `verifyPasswordSectionDescriptionVisible()` → `verifyPasswordInfoIconVisible()`
- [x] `verifySectionHeadersAndDescriptionsVisible()` → `verifySectionHeadersAndInfoIconsVisible()`

#### CreateGroupModalPage.ts
- [x] `getGroupNameHelpText()` → `getGroupNameInfoIcon()`
- [x] `getGroupDisplayNameHelpText()` → `getGroupDisplayNameInfoIcon()`
- [x] `getGroupDescriptionHelpText()` → `getGroupDescriptionInfoIcon()`
- [x] `verifyHelpTextDisplayed()` → `verifyInfoIconsDisplayed()`

### Tests Updated

#### settings-functionality.test.ts
- [x] Updated test assertions to use new info icon verification methods

#### dashboard-modals.test.ts
- [x] Updated `verifyHelpTextDisplayed()` → `verifyInfoIconsDisplayed()`

### Documentation Updated
- [x] `docs/guides/webapp-and-style-guide.md` - Added info icon pattern to UI Patterns Quick Reference and Anti-Patterns

### Bug Fixes During Implementation
- [x] **Tooltip.tsx** - Changed z-index from `z-50` to `z-[100]` so tooltips appear above modals (which use z-50)
- [x] **CreateGroupModal.tsx** - Restored required field indicators (`*`) to Group Name and Group Display Name labels (lost when switching from Input's built-in label to custom labels with info icons)

---

## Skipped (Low Priority / Better Visible)

These were assessed and intentionally left as-is:

- **GroupGeneralTabContent.tsx** - Group lock warning: Important safety warning
- **SplitAmountInputs.tsx** - Active task instructions users need while entering data
- **PayerSelector.tsx** - Placeholder text, not explainer text
- **CommentInput.tsx** - Very small inline helper text
- **AttachmentUploader.tsx** - Small text next to button

---

## Pattern Used

```tsx
import { InfoCircleIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';

// Place next to label text
<Tooltip content={t('translation.key.for.explainer')} placement='top'>
    <Clickable
        as='button'
        type='button'
        className='text-text-muted hover:text-text-primary transition-colors p-0.5 rounded focus:outline-hidden focus:ring-2 focus:ring-interactive-primary'
        aria-label={t('common.moreInfo')}
    >
        <InfoCircleIcon size={16} />
    </Clickable>
</Tooltip>
```
