#!/bin/bash

# Script to run individual Playwright tests quickly
# Usage:
#   ./run-test.sh <test-file>                    # Run entire test file
#   ./run-test.sh <test-file> <test-name>        # Run specific test
#   ./run-test.sh <test-file> --headed           # Run with browser visible
#   ./run-test.sh <test-file> <test-name> --headed  # Run specific test with browser visible

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./run-test.sh <test-file>                    # Run entire test file"
    echo "  ./run-test.sh <test-file> <test-name>        # Run specific test"
    echo "  ./run-test.sh <test-file> --headed           # Run with browser visible"
    echo "  ./run-test.sh <test-file> <test-name> --headed  # Run specific test with browser visible"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./run-test.sh login                          # Run all login tests"
    echo "  ./run-test.sh login \"should show error\"       # Run specific test"
    echo "  ./run-test.sh dashboard --headed             # Run dashboard tests with browser"
    echo ""
    echo -e "${YELLOW}Available test files:${NC}"
    find src/__tests__/unit/playwright -name "*.test.ts" -exec basename {} .test.ts \; | sort
}

# Check if no arguments provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

TEST_FILE="$1"
TEST_NAME=""
HEADED_FLAG=""

# Parse arguments
shift
while [ $# -gt 0 ]; do
    case "$1" in
        --headed)
            HEADED_FLAG="--headed"
            ;;
        *)
            if [ -z "$TEST_NAME" ]; then
                TEST_NAME="$1"
            else
                echo -e "${RED}Error: Too many arguments${NC}"
                show_usage
                exit 1
            fi
            ;;
    esac
    shift
done

# Find the test file
TEST_PATH=""
if [ -f "src/__tests__/unit/playwright/${TEST_FILE}.test.ts" ]; then
    TEST_PATH="src/__tests__/unit/playwright/${TEST_FILE}.test.ts"
elif [ -f "src/__tests__/unit/playwright/${TEST_FILE}" ]; then
    TEST_PATH="src/__tests__/unit/playwright/${TEST_FILE}"
elif [ -f "${TEST_FILE}" ]; then
    TEST_PATH="${TEST_FILE}"
else
    echo -e "${RED}Error: Test file not found${NC}"
    echo "Tried:"
    echo "  - src/__tests__/unit/playwright/${TEST_FILE}.test.ts"
    echo "  - src/__tests__/unit/playwright/${TEST_FILE}"
    echo "  - ${TEST_FILE}"
    echo ""
    show_usage
    exit 1
fi

# Build the command - run chromium project only by default
# Use --max-failures=0 to run all tests and show all failures (0 means unlimited)
CMD="PLAYWRIGHT_HTML_OPEN=never npx playwright test \"${TEST_PATH}\" --project=chromium --workers=1"

# Add test name filter if provided
if [ -n "$TEST_NAME" ]; then
    CMD="${CMD} --grep \"${TEST_NAME}\""
fi

# Add headed flag if provided
if [ -n "$HEADED_FLAG" ]; then
    CMD="${CMD} ${HEADED_FLAG}"
fi

# Add reporter
CMD="${CMD} --reporter=list"

# For single test runs, recommend running full file instead for better browser reuse
if [ -n "$TEST_NAME" ]; then
    echo -e "${YELLOW}Note: Running single tests requires browser startup/shutdown.${NC}"
    echo -e "${YELLOW}For faster execution, run: ./run-test.sh ${TEST_FILE}${NC}"
    echo ""
fi

# Show what we're running
echo -e "${GREEN}Running:${NC} ${CMD}"
echo ""

# Execute the command
eval $CMD