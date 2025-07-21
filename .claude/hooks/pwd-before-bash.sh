#!/bin/bash

# This hook runs before any bash command to ensure Claude knows the current directory
# It helps prevent file access errors by making the working directory explicit

# Read the JSON input from stdin (but we don't need to parse it for this simple case)
cat > /dev/null

# Output the current directory to stderr so it shows up in Claude's output
echo "=== Current Working Directory ===" >&2
pwd >&2
echo "=================================" >&2
echo "" >&2

# Exit with 0 to allow the command to proceed
exit 0