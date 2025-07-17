# Evaluate Script Loader Component Necessity

## Issue
The script loader component might be unnecessary complexity if scripts are loaded consistently elsewhere.

## Location
`/webapp/src/js/components/script-loader.ts`

## Current Usage
Need to verify where and how this component is actually used.

## Action Required
1. Search for usage of the ScriptLoader component
2. Determine if it provides value over standard script loading
3. Consider if scripts could be loaded more simply
4. Remove if unnecessary or document its purpose clearly

## Questions to Answer
- How many scripts are dynamically loaded?
- Is there complex loading logic that justifies a component?
- Could scripts be loaded statically in HTML or with simpler code?
- Are there timing/dependency requirements that necessitate this component?