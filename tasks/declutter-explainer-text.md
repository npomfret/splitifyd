# Declutter Explainer Text with Info Icons

Replace inline help/explainer text with `InfoCircleIcon` + `Tooltip` pattern to declutter UI.

**Reference implementation:** `webapp-v2/src/components/groups/settings/CustomPermissionsSection.tsx`

---

## High Priority

### CreateGroupModal.tsx
- [ ] Group name help text (line ~293)
- [ ] Group display name help text (line ~313)
- [ ] Group description help text (line ~332)

### SettingsPage.tsx
- [ ] Profile information section description (line ~382)
- [ ] Display name helper text (line ~409)
- [ ] Email section description (line ~427)
- [ ] Password section intro text (line ~506)
- [ ] Language selector description (line ~601)

### GroupCurrencySettings.tsx
- [ ] Currency settings section description (line ~109)

### GroupGeneralTabContent.tsx
- [ ] Group lock warning text (line ~193)

---

## Medium Priority

### JoinGroupPage.tsx
- [ ] Display name purpose description (line ~276)

### SplitAmountInputs.tsx
- [ ] Instructions for exact amounts (line ~54)
- [ ] Instructions for percentage splits (line ~119)

### PayerSelector.tsx
- [ ] "Select payer" instruction text (line ~85)

### CommentInput.tsx
- [ ] Character count info (line ~124)

### AttachmentUploader.tsx
- [ ] Attachment helper text (line ~221)

---

## Admin Pages (Lower Priority)

### UserEditorModal.tsx
- [ ] Profile tab description (line ~246)
- [ ] Role tab description (line ~280)
- [ ] Individual role option descriptions (line ~305)

### TenantEditorModal.tsx
- [ ] Mode selector hint text (lines ~354-358)
- [ ] Various section descriptions

### TenantBrandingPage.tsx
- [ ] Branding assets description (line ~216)
- [ ] Preview section description (line ~277)
- [ ] Marketing section description (line ~319)
- [ ] Marketing flag descriptions (lines ~334, 349)

---

## Pattern to Use

```tsx
import { InfoCircleIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/Tooltip';
import { Clickable } from '@/components/ui/Clickable';

// Place next to label text
<Tooltip content={t('translation.key.for.explainer')} placement='top'>
    <Clickable
        as='button'
        type='button'
        className='text-text-muted hover:text-text-primary transition-colors p-0.5 -mr-0.5 rounded focus:outline-hidden focus:ring-2 focus:ring-interactive-primary'
        aria-label={t('aria.label.for.info')}
    >
        <InfoCircleIcon size={16} />
    </Clickable>
</Tooltip>
```

---

## Notes

- Keep essential validation messages (FieldError) as inline text
- Status indicators (loading, progress) should remain visible
- Only move "what this means" type explanations to tooltips
- Ensure translations exist for tooltip content
