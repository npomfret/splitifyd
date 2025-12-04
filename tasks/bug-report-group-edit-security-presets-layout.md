# Bug Report: Group Security Presets - Squashed Text

## Overview
When editing a group and navigating to the "Security & Permissions" section, the two preset options displayed at the top have their text content severely squashed or compressed. This makes the text difficult to read and negatively impacts the user interface.

## Steps to Reproduce
1. Log in to the application.
2. Navigate to a group that you own or have permission to edit.
3. Open the group's settings or edit interface.
4. Navigate to the "Security & Permissions" tab or section.
5. Observe the layout and readability of the text within the preset options (e.g., "Public Group", "Private Group" or similar) at the top of this section.

## Expected Behavior
The text within the security preset options should be clearly legible, with adequate spacing and without any visual squashing or compression, allowing users to easily understand each preset's description.

## Actual Behavior
The text content for the two security preset options at the top of the "Security & Permissions" section is squashed, making it difficult to read and appearing visually unappealing.

## Impact
- **User Experience:** Poor readability and an unprofessional appearance can frustrate users and hinder their ability to make informed decisions about group security settings.
- **Usability:** Users may misunderstand the presets due to squashed text, leading to incorrect security configurations.

## Possible Cause (Initial Thoughts)
This issue is likely related to CSS styling or layout constraints within the component displaying these presets. Possible causes include:
- Insufficient width allocated to the container holding the text.
- Overly aggressive `flex` or `grid` item sizing properties that don't account for text length.
- Lack of proper `white-space` handling (e.g., `white-space: normal;`) or `word-break` properties.
- Fixed height or width on a parent element that is too small for the content.

## Priority
Medium - Primarily a UI/UX issue that affects readability and aesthetic, but doesn't prevent functionality entirely. It could, however, lead to user errors in selecting appropriate security settings.