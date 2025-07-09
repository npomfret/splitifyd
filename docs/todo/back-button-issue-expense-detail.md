
# Back button does not work on expense-detail.html

**Date:** 2025-07-09

**Problem:**
The back button on the `expense-detail.html` page does not function as expected. It appears to always redirect to `dashboard.html` instead of the previous page.

**Investigation:**
The javascript file `webapp/js/expense-detail.js` contains the following code:

```javascript
document.getElementById('backButton').addEventListener('click', () => {
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
    window.location.href = returnUrl || 'dashboard.html';
});
```

The code attempts to get a `returnUrl` from the current URL's query parameters. If `returnUrl` is not present, it defaults to `dashboard.html`.

The root cause of the issue is that no `returnUrl` parameter is being added to the URL when navigating to the `expense-detail.html` page.

**Recommendation (for fix):**
When linking to the expense detail page, a `returnUrl` query parameter should be added to the URL. The value of this parameter should be the URL of the page the user is coming from.

For example, if the user is on a group detail page, the link to an expense should be:
`/expense-detail.html?id=<expenseId>&returnUrl=/group-detail.html?id=<groupId>`
