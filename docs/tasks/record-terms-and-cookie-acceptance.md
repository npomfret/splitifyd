## Task: Add Mandatory Terms and Cookie Policy Acceptance to Registration

**Goal:**
Ensure that users explicitly agree to the Terms of Service and the Cookie Policy during the registration process.

**Requirements:**
1.  **Add Checkboxes:**
    *   Add two new checkboxes to the user registration form.
    *   One checkbox labeled "I accept the Terms of Service."
    *   One checkbox labeled "I accept the Cookie Policy."
    *   The labels should link to the respective policy pages.

2.  **Mandatory Acceptance:**
    *   Both checkboxes must be checked for the registration/submit button to be enabled.
    *   The form cannot be submitted unless both are checked.

3.  **Record Acceptance:**
    *   When the user successfully registers, record their acceptance in the database.
    *   Store a boolean `true` and a timestamp for both `termsAccepted` and `cookiePolicyAccepted` in the user's profile or a related record.

**Justification:**
This is a necessary step for legal compliance and to ensure we have a clear record of user consent.
