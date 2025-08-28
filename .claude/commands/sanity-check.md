# Sanity check

First, read all md files in docs/guides/ from the project root - study them, they are extremely important.

Simply analyse the current changeset...

- [ ] is it sufficiently tested? **Do not run any tests!** Analyse the code changes and any tests that exercise them.
- [ ] are tests _tidy_? do they user builders to hide away noise? Do they use drivers or POMs to abstract away complexity?
- [ ] is there any unused code?
- [ ] are there any type safety improvements that could be made?
- [ ] is there any code that confuses optional v's mandatory parameters?
- [ ] is there any uncalled-for "backward compatible" code? (there is **no** production data to migrate)
- [ ] is there any duplication?
- [ ] are there any un-tracked files? You must either `git add` them, _delete_ them or in special cases (ask for permission) _git ignore_ them
- [ ] has anything been added that wasn't called for?
- [ ] have any relevant any task docs been updated?

Finally: do you have any questions for the user?

Report back.
