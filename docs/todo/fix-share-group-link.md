# Fix: Share Group Link Missing in UI

## Problem Description
When attempting to share a group in the UI, the generated link is not displayed in the text field of the share modal. The text field appears empty.

## Root Cause Analysis
The `showShareGroupModal` function in `webapp/src/js/group-detail.ts` calls `apiService.generateShareableLink` to obtain the shareable URL. The `apiService.generateShareableLink` function in `webapp/src/js/api.ts` makes a POST request to the `/groups/share` endpoint.

The most probable causes are:
1. The `/groups/share` API endpoint is not returning a valid URL in its response.
2. The `ShareableLinkResponse` type definition in `webapp/src/js/types/api.ts` might be incorrect or incomplete, leading to a mismatch in how the `url` property is accessed.
3. An error occurs during the API call, but it's not being properly caught or handled, resulting in an empty `shareUrl`.

## Implementation Plan

### Step 1: Verify API Response and Type Definition

1.  **Inspect `ShareableLinkResponse` type:**
    *   Read `webapp/src/js/types/api.ts` to confirm the structure of `ShareableLinkResponse` and ensure it correctly defines a `url` property of type `string`.

2.  **Add Logging in `group-detail.ts`:**
    *   Modify `webapp/src/js/group-detail.ts` to add `logger.log` statements within the `showShareGroupModal` function.
    *   Log the `response` object received from `apiService.generateShareableLink`.
    *   Log the `shareUrl` variable immediately after it's assigned (`const shareUrl = response.data!.url;`).

    ```typescript
    // webapp/src/js/group-detail.ts
    async function showShareGroupModal(): Promise<void> {
        // ... existing code ...
        try {
            const response = await apiService.generateShareableLink(currentGroupId);
            logger.log('API Response for shareable link:', response); // ADD THIS LINE
            const shareUrl = response.data!.url;
            logger.log('Share URL extracted:', shareUrl); // ADD THIS LINE
            // ... rest of the function ...
        } catch (error) {
            logger.error('Error generating share link:', error);
            showMessage('Failed to generate share link', 'error');
        }
    }
    ```

### Step 2: Debug and Identify the Issue

1.  Run the application in the Firebase Emulator.
2.  Navigate to a group's detail page.
3.  Click the "Invite" button to open the share modal.
4.  Observe the console logs for the output of the added `logger.log` statements.
    *   If `response.data.url` is `undefined` or `null`, the issue is with the backend API not returning the URL.
    *   If `response.data.url` contains a valid URL, but the input field is still empty, the issue is with the DOM manipulation or the `value` assignment to the input element.

### Step 3: Implement the Fix (Conditional based on Step 2 findings)

*   **Scenario A: Backend API Issue (No URL returned)**
    *   **Action:** Investigate the Firebase Function responsible for `/groups/share`. This likely involves examining `firebase/functions/src/groups/share.ts` (or similar).
    *   **Fix:** Ensure the Firebase Function correctly generates and returns the shareable URL in the expected `ShareableLinkResponse` format.

*   **Scenario B: Frontend DOM Manipulation Issue (URL is valid, but not displayed)**
    *   **Action:** Review the `createElementSafe` and `input.value = shareUrl` lines in `showShareGroupModal`.
    *   **Fix:** Ensure the input element is correctly created and the `value` property is set before the modal is displayed.

### Step 4: Testing

1.  After implementing the fix, run the application in the Firebase Emulator.
2.  Verify that clicking the "Invite" button now populates the share link text field with a valid URL.
3.  Test the "Copy" button functionality.

### Step 5: Cleanup

1.  Remove the added `logger.log` statements from `webapp/src/js/group-detail.ts` once the issue is resolved and verified.
