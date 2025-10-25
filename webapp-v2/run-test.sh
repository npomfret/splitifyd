#!/bin/bash

# Script to run individual Playwright tests quickly and repeatedly
# Usage:
#   ./run-test.sh <test-file>                              # Run entire test file once
#   ./run-test.sh <test-file> <test-name>                  # Run specific test once
#   ./run-test.sh <test-file> --headed                     # Run with browser visible
#   ./run-test.sh <test-file> <test-name> --headed         # Run specific test with browser visible
#   ./run-test.sh <test-file> <test-name> --repeat 10      # Run test 10 times until failure
#   ./run-test.sh <test-file> <test-name> --repeat 10 --headed  # Run 10 times with visible browser

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./run-test.sh <test-file>                              # Run entire test file once"
    echo "  ./run-test.sh <test-file> <test-name>                  # Run specific test once"
    echo "  ./run-test.sh <test-file> --headed                     # Run with browser visible"
    echo "  ./run-test.sh <test-file> <test-name> --headed         # Run specific test with browser visible"
    echo "  ./run-test.sh <test-file> <test-name> --repeat N       # Run test N times until failure"
    echo "  ./run-test.sh <test-file> <test-name> --repeat N --headed  # Run N times with visible browser"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./run-test.sh login                          # Run all login tests once"
    echo "  ./run-test.sh login \"should show error\"       # Run specific test once"
    echo "  ./run-test.sh dashboard --headed             # Run dashboard tests with browser"
    echo "  ./run-test.sh dashboard \"should load groups\" --repeat 50  # Run test 50 times"
    echo ""
    echo -e "${YELLOW}Available test files:${NC}"
    find src/__tests__/integration/playwright -name "*.test.ts" -exec basename {} .test.ts \; | sort
}

# Check if no arguments provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

TEST_FILE="$1"
TEST_NAME=""
HEADED_FLAG=""
REPEAT_COUNT=3

# Parse arguments
shift
EXPLICIT_REPEAT=false
while [ $# -gt 0 ]; do
    case "$1" in
        --headed)
            HEADED_FLAG="--headed"
            # Set repeat to 1 for headed mode unless explicitly overridden
            if [ "$EXPLICIT_REPEAT" = false ]; then
                REPEAT_COUNT=1
            fi
            ;;
        --repeat)
            shift
            if [ $# -eq 0 ] || ! [[ "$1" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Error: --repeat requires a number${NC}"
                show_usage
                exit 1
            fi
            REPEAT_COUNT="$1"
            EXPLICIT_REPEAT=true
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
if [ -f "src/__tests__/integration/playwright/${TEST_FILE}.test.ts" ]; then
    TEST_PATH="src/__tests__/integration/playwright/${TEST_FILE}.test.ts"
elif [ -f "src/__tests__/integration/playwright/${TEST_FILE}" ]; then
    TEST_PATH="src/__tests__/integration/playwright/${TEST_FILE}"
elif [ -f "${TEST_FILE}" ]; then
    TEST_PATH="${TEST_FILE}"
else
    echo -e "${RED}Error: Test file not found${NC}"
    echo "Tried:"
    echo "  - src/__tests__/integration/playwright/${TEST_FILE}.test.ts"
    echo "  - src/__tests__/integration/playwright/${TEST_FILE}"
    echo "  - ${TEST_FILE}"
    echo ""
    show_usage
    exit 1
fi

# Build the command
HOST="${PLAYWRIGHT_DEV_HOST:-127.0.0.1}"
if [ -n "${PLAYWRIGHT_DEV_PORT}" ]; then
    DEV_PORT="${PLAYWRIGHT_DEV_PORT}"
else
    DEV_PORT=$(( (RANDOM % 10000) + 40000 ))
fi

SERVER_LOG=$(mktemp -t playwright-dev-XXXX.log)
SERVER_PID=""

# Create output directory and log file
OUTPUT_DIR="playwright-report/run-test"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
OUTPUT_LOG="${OUTPUT_DIR}/${TEST_FILE}-${TIMESTAMP}.log"

# Function to log to both console and file
log() {
    echo -e "$@" | tee -a "$OUTPUT_LOG"
}

# Function to log without color codes to file
log_clean() {
    # Remove color codes for file output
    local message="$@"
    echo -e "$message" >&1
    echo -e "$message" | sed 's/\x1b\[[0-9;]*m//g' >> "$OUTPUT_LOG"
}

cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" >/dev/null 2>&1 || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    if [ -f "$SERVER_LOG" ]; then
        rm -f "$SERVER_LOG"
    fi
}

start_dev_server() {
    npm run dev -- --host "$HOST" --port "$DEV_PORT" >"$SERVER_LOG" 2>&1 &
    SERVER_PID=$!

    ATTEMPTS=0
    MAX_ATTEMPTS=120
    until curl -s "http://${HOST}:${DEV_PORT}/" >/dev/null 2>&1; do
        ATTEMPTS=$((ATTEMPTS + 1))
        if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
            log_clean "${RED}Failed to start dev server on http://${HOST}:${DEV_PORT}/${NC}"
            log_clean "${YELLOW}Server log:${NC}"
            cat "$SERVER_LOG" | tee -a "$OUTPUT_LOG"
            cleanup
            exit 1
        fi
        sleep 0.25
    done
}

trap cleanup EXIT

# Write log header
log_clean "=============================================="
log_clean "Playwright Test Run"
log_clean "Started: $(date)"
log_clean "Test File: ${TEST_PATH}"
if [ -n "$TEST_NAME" ]; then
    log_clean "Test Name: ${TEST_NAME}"
fi
log_clean "Repeat Count: ${REPEAT_COUNT}"
if [ -n "$HEADED_FLAG" ]; then
    log_clean "Browser Mode: HEADED"
else
    log_clean "Browser Mode: HEADLESS"
fi
log_clean "=============================================="
log_clean ""

start_dev_server

CMD="PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_DEV_PORT=${DEV_PORT} PLAYWRIGHT_HTML_OPEN=never npx playwright test \"${TEST_PATH}\" --project=chromium --workers=1"

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

# Run test(s) repeatedly
if [ "$REPEAT_COUNT" -gt 1 ]; then
    SUCCESS_COUNT=0
    START_TIME=$(date +%s)

    log_clean "${YELLOW}Running test repeatedly (up to ${REPEAT_COUNT} times until failure)${NC}"
    if [ -n "$HEADED_FLAG" ]; then
        log_clean "${YELLOW}Browser mode: HEADED (visible browser window)${NC}"
    else
        log_clean "${YELLOW}Browser mode: HEADLESS (background execution)${NC}"
    fi
    log_clean ""

    for ((RUN=1; RUN<=REPEAT_COUNT; RUN++)); do
        CURRENT_TIME=$(date +%s)
        ELAPSED=$((CURRENT_TIME - START_TIME))

        log_clean "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        log_clean "${GREEN}Run #${RUN}/${REPEAT_COUNT} (${ELAPSED}s elapsed) - $(date '+%H:%M:%S')${NC}"
        log_clean "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

        # Run the test (output goes to both console and log file)
        # Use PIPESTATUS to get the actual command exit code, not tee's exit code
        set +e
        eval $CMD 2>&1 | tee -a "$OUTPUT_LOG"
        TEST_EXIT_CODE=${PIPESTATUS[0]}
        set -e

        if [ $TEST_EXIT_CODE -ne 0 ]; then
            FINAL_TIME=$(date +%s)
            TOTAL_ELAPSED=$((FINAL_TIME - START_TIME))
            log_clean ""
            log_clean "${RED}💥 TEST FAILED on run #${RUN}!${NC}"
            log_clean "${YELLOW}⏱️  Total time: ${TOTAL_ELAPSED}s${NC}"
            log_clean "${YELLOW}📊 Average time per run: $((TOTAL_ELAPSED / RUN))s${NC}"
            log_clean "${YELLOW}🏁 Stopped at: $(date)${NC}"
            exit 1
        fi

        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        log_clean "${GREEN}✅ Run #${RUN} completed successfully (${SUCCESS_COUNT}/${REPEAT_COUNT} successes)${NC}"
        log_clean ""

        # Small delay to avoid overwhelming the system
        if [ $RUN -lt $REPEAT_COUNT ]; then
            sleep 1
        fi
    done

    FINAL_TIME=$(date +%s)
    TOTAL_ELAPSED=$((FINAL_TIME - START_TIME))
    log_clean ""
    log_clean "${GREEN}🎉 SUCCESS! Completed ${REPEAT_COUNT} runs without failure${NC}"
    log_clean "${YELLOW}⏱️  Total time: ${TOTAL_ELAPSED}s${NC}"
    log_clean "${YELLOW}📊 Average time per run: $((TOTAL_ELAPSED / REPEAT_COUNT))s${NC}"
    log_clean "${YELLOW}🏁 Stopped at: $(date)${NC}"
else
    # Single run
    if [ -n "$TEST_NAME" ]; then
        log_clean "${YELLOW}Note: Running single tests requires browser startup/shutdown.${NC}"
        log_clean "${YELLOW}For faster execution, run: ./run-test.sh ${TEST_FILE}${NC}"
        log_clean ""
    fi

    log_clean "${GREEN}Running:${NC} ${CMD}"
    log_clean ""

    # Run the test (output goes to both console and log file)
    # Use PIPESTATUS to preserve the actual command exit code
    set +e
    eval $CMD 2>&1 | tee -a "$OUTPUT_LOG"
    TEST_EXIT_CODE=${PIPESTATUS[0]}
    set -e
fi

# Write log footer
log_clean ""
log_clean "=============================================="
log_clean "Test Run Completed: $(date)"
log_clean "Log saved to: webapp-v2/${OUTPUT_LOG}"
log_clean "=============================================="

# Exit with the test's exit code (for single run case)
if [ "$REPEAT_COUNT" -eq 1 ]; then
    exit $TEST_EXIT_CODE
fi
