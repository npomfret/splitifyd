# Sanity check

First, read all md files in docs/guides/ from the project root - study them, they are extremely important.

Analyse the current changeset...

- [ ] is it sufficiently tested? 
- [ ] is there any unused code? 
- [ ] are there any type safety improvements that could be made? 
- [ ] is there any code that confuses optional v's mandatory parameters? 
- [ ] is there any uncalled-for "backward compatible" code? (there is **no** production data to migrate)
- [ ] is there any duplication? 
- [ ] have new files (that are needed) been added to git?
- [ ] has anything been added that wasn't called for?

Finally: do you have any questions for the user?