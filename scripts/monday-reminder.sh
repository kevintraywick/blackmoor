#!/bin/bash
# Monday feature release reminder — reads Calendar.md and sends a macOS notification
CALENDAR="/Users/moon/blackmoor/Calendar.md"
TODAY=$(date +%Y-%m-%d)
NEXT_MONDAY=$(date -v+7d +%Y-%m-%d)

# Find features scheduled for this week (today's Monday date)
FEATURES=$(sed -n "/^### $TODAY/,/^### /{ /^### $TODAY/d; /^### /d; /^$/d; p; }" "$CALENDAR")

if [ -z "$FEATURES" ] || echo "$FEATURES" | grep -q "No features scheduled"; then
  MSG="No features scheduled this week. Check Calendar.md to plan ahead."
else
  MSG="This week's features:
$FEATURES"
fi

osascript -e "display notification \"$MSG\" with title \"Blackmoor Feature Week\" subtitle \"$TODAY\""
