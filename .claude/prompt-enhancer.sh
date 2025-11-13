#!/bin/bash

# Store the cookies in some local dir thats not under version control
TMP_DIR="tmp"
COOKIE_FILE="${TMP_DIR}/prompt-enhancer/cookies.txt"
LOG_FILE="${TMP_DIR}/prompt-enhancer/activity.log"

# Create tmp dir if it doesn't exist
mkdir -p "$(dirname "$COOKIE_FILE")"

# Delete stale cookies (older than 1 hour)
if [ -f "$COOKIE_FILE" ]; then
    # Check if file is older than 1 hour (3600 seconds)
    if [ "$(find "$COOKIE_FILE" -mmin +60 2>/dev/null)" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Deleting stale cookies (>1 hour old)" >> "$LOG_FILE"
        rm -f "$COOKIE_FILE"
    fi
fi

# Read the JSON input from stdin
JSON_INPUT=$(cat)

# Log the raw JSON input and timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') - Received input: $JSON_INPUT" >> "$LOG_FILE"

# Extract the prompt from the JSON input
PROMPT=$(echo "$JSON_INPUT" | jq -r '.prompt')

# Check for underscore trigger
if [[ "$PROMPT" == _* || "$PROMPT" == *_ ]]; then
    # Use jq to properly construct JSON payload for the enhancer service
    JSON_PAYLOAD=$(jq -n --arg msg "$PROMPT" '{message: $msg}')

    # Execute the curl command and get the full response
    RESPONSE=$(curl --silent --show-error -X POST https://promptly.snowmonkey.co.uk/enhance?projectId=cec04d6b28ab \
        -H "Content-Type: application/json" \
        -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
        -d "$JSON_PAYLOAD" 2>/dev/null)

    # Check if the response contains an error
    ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')

    if [ -n "$ERROR" ]; then
        # Log the error
        DETAILS=$(echo "$RESPONSE" | jq -r '.details // empty')
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: $ERROR - $DETAILS" >> "$LOG_FILE"

        # Output error to stderr
        echo "Error from prompt-enhancer service:" >&2
        echo "  $ERROR" >&2
        if [ -n "$DETAILS" ]; then
            echo "  Details: $DETAILS" >&2
        fi
        exit 1
    fi

    # Extract the enhancement from successful response
    ENHANCEMENT=$(echo "$RESPONSE" | jq -r '.response // empty')

    # Log the response
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Response received (${#ENHANCEMENT} chars)" >> "$LOG_FILE"

    # Output the final JSON with additionalContext
    jq -n --arg context "$ENHANCEMENT" '{"additionalContext": $context}'
else
    # If no underscore, just output the original JSON input
    echo "$JSON_INPUT"
fi
