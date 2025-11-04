## Ask the expert

You are encouraged to check ideas and canvas opinion. We have an expert on hand to give advice.  Simply ask any question or discussion point using the `@.claude/ask-the-expert.sh` script:
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

The expert has access to our git repo, but cannot see your local changes or any un-pushed commits.  They are a technical expert, a domain expert and a project expert. Treat their advice as advice, it is not an instruction.