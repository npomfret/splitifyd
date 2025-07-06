# Analyse

Do a deep analysis of this entire project (except the ignored stuff). I want you to find all areas of the codebase that can be improved.  

The project's .md files will give you an idea of the general approach. 

I want you to look for:

- quick wins
- duplication;
- obvious bugs
- performance bottle necks
- complex code
- improve usability blunders
- obvious missing features
- non standard approaches to common problems
- build, deployment and configuration complexity or weirdness

Put each suggestion into a file of its own in a directory called `/todo`. In each file, describe the problem and suggested solution, state if there is a behaviour change (or it's a pure refactoring);

State the risk, complexity and benefit. 

Add as much detail in each file as you can to help an implementor. 

Create a file for EVERY individual issue, don't batch them up. For example, if you find a bug regarding login, then create `todo/login-bug.md`.

Do not number the files, just given them sensible names.       │

## Don't be vague
- Mention exact file paths where the problems exist
- Provide sample code IF appropriate
- Provide links to documentation or example code IF appropriate