#!/bin/bash

TEST_FILE="src/tests/normal-flow/dashboard-happy-path.e2e.test.ts"
TEST_FILTER="should properly clear all state and prevent unauthorized access after logout"

RUN_COUNT=0
START_TIME=$(date +%s)

# Clean up any existing screenshots in the ad-hoc folder
echo "🧹 Cleaning up existing screenshots in playwright-report/ad-hoc..."
rm -f playwright-report/ad-hoc/*.png 2>/dev/null

echo "🚀 Starting repeated test runs for: $TEST_FILE"
echo "🎯 Test filter: '$TEST_FILTER'"
echo "📍 Working directory: $(pwd)"
echo "⏰ Started at: $(date)"
echo ""

while true; do
    RUN_COUNT=$((RUN_COUNT + 1))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Run #$RUN_COUNT (${ELAPSED}s elapsed) - $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Run the test
    npm run build && PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT=playwright-report/ad-hoc npx playwright test --workers=1 --headed --project=chromium --reporter=html "$TEST_FILE" --grep "$TEST_FILTER"
    
    # Check exit code
    if [ $? -ne 0 ]; then
        FINAL_TIME=$(date +%s)
        TOTAL_ELAPSED=$((FINAL_TIME - START_TIME))
        echo ""
        echo "💥 TEST FAILED on run #$RUN_COUNT!"
        echo "⏱️  Total time: ${TOTAL_ELAPSED}s"
        echo "📊 Average time per run: $((TOTAL_ELAPSED / RUN_COUNT))s"
        echo "🏁 Stopped at: $(date)"
        exit 1
    fi
    
    echo "✅ Run #$RUN_COUNT completed successfully"
    echo ""
    
    # Small delay to avoid overwhelming the system
    sleep 2
done
