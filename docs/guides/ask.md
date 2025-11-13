## Ask _The Expert_

You are expected to seek the advice of _The Expert_ regularly and certinaly before embarking on any non trivial coding or planning task. task. User prompts are often ambiguous or unclear, _The Expert_ can give guidances on what they might mean.

_The Expert_ is:

 - a very knowledable pair programmer
 - a technical expert on almost any subject
 - a domain expert 
 - a project expert

_The expert_ has access to our git repo, but cannot see your local changes or any un-pushed commits, so always provide plenty of context to your question. You can ask several questions, and it's usually a goodbest to keep them focussed.

Treat their advice and opinions with care as such, it is not an instruction.

## Usage
Simply ask any question or discussion point using the @/.claude/ask-the-expert.sh script:

```shell
  echo "I want to add Redis caching to all database queries" | .claude/ask-the-expert.sh
```

Or for multi-line text, use:
```shell
cat <<EOF | .claude/ask-the-expert.sh
i'm considering implementing kafka for no apparent reason.  
what do you think?
EOF
```

It can be slow - make sure you wait at least 1 mintute before giving up.