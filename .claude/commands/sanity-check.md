# Sanity check

First, read all md files in @docs/guides/ and study carefully them, they are extremely important.

Carefully analyse the current changeset. First use git to find every single local change, including untracked files.

Once you understand the changeset, and you understand and appreciate the guiding principles of the project, review the changeset...

- [ ] is it sufficiently tested? **Do not run the tests!** Just look at the code, and look at the surrounding tests and make a decision.
- [ ] are tests _tidy_? do they user builders to hide away noise? Do they use drivers or POMs to abstract away complexity?
- [ ] is there any unused code? or code that is only called by tests. Unused code is never allowed.
- [ ] are there any type safety improvements that could be made?
- [ ] is there any code that uses optional parameters that are really mandatory, or always supplied?
- [ ] is there any uncalled-for "backward compatible" code? (there is **no** production data to migrate)
- [ ] is there any duplication or redundancy?
- [ ] is it only half done!?
- [ ] does it violate **any** of our rules and guideslines?
- [ ] have new patterns been introduced where existing patterns should have been followed?
- [ ] are there any **un-tracked** files? You must either `git add` them, _delete_ them or in special cases (ask for permission) _git ignore_ them
- [ ] has anything been added that wasn't called for (referencing any task/md file)?
- [ ] have any relevant any task docs been accurately updated?
- [ ] does it compile? (run `npm run build` from the project root)

**DO NOT CHANGE ANY CODE**

Finally: do you have any questions for the user?

Report back.
