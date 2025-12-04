# Bug Report: Group Header Information is Too Verbose and Needs Revision

## Overview
The information displayed in the sub-header on the group detail page is overly verbose and contains redundant details. The current format is difficult to scan and includes information that could be simplified or replaced for better clarity and utility.

## Steps to Reproduce
1. Log in to the application.
2. Navigate to any group detail page.
3. Observe the line of text directly below the main group name in the header.

## Expected Behavior
The group header's sub-text should be concise, providing a clear summary of the group's key stats. A much-improved format would be:
`[X] members, [time] old, last updated [time]`

For example:
**"3 members, 2 hours old, last updated 5 minutes ago"**

This format is scannable and prioritizes the most relevant metadata.

## Actual Behavior
The current header displays a long, cluttered string with less useful and redundant information. The format is similar to this:
**"3 members 4 Recent expenses Created 2 hours ago 2025-12-04 10:42:47"**

The issues with the current format are:
- The count of "Recent expenses" is of questionable value in a summary header.
- It shows both a relative creation time ("2 hours ago") and an absolute timestamp, which is redundant.
- The different pieces of information are run together without clear separators like commas, making it hard to parse.

## Impact
- **Poor Readability:** The current layout is cluttered and difficult for users to read at a glance.
- **Information Hierarchy:** It gives prominence to less critical information (like the exact creation timestamp) while omitting more useful data, such as when the group was last active ("last updated").
- **UI Polish:** The unformatted string feels unpolished and detracts from the overall quality of the user interface.

## Priority
Medium - This is a UI/UX improvement that directly impacts the clarity and usability of a frequently viewed page. While it doesn't break functionality, it makes the interface feel cluttered and less professional.