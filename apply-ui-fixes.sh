#!/bin/bash

# Script to apply remaining UI fixes to FeedStream-PWA
# This makes surgical edits to +page.svelte

FILE="/Volumes/USB STORAGE/Projects/FeedStream-PWA/web/src/routes/+page.svelte"
BACKUP="${FILE}.backup-$(date +%Y%m%d-%H%M%S)"

echo "Creating backup: $BACKUP"
cp "$FILE" "$BACKUP"

echo "Applying UI fixes..."

# 1. Add mobile FAB button after line 2927
# Insert after the mobile tab bar closing {/if}
sed -i '' '2927 a\
\
\t<!-- Mobile Floating Add Button -->\
\t{#if isMobile}\
\t\t<button class="mobile-fab" on:click={openAddFeedModal} title="Add Feeds">\
\t\t\t<svg width="24" height="24" viewBox="0 0 24 24" fill="none">\
\t\t\t\t<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>\
\t\t\t</svg>\
\t\t</button>\
\t{/if}\
' "$FILE"

# 2. Change bookmark colors from green to orange
# Find .star-btn.starred and change color
sed -i '' 's/\.star-btn\.starred {$/&\n\t\tcolor: #FF9500; \/* Orange bookmarks *\//g' "$FILE"
sed -i '' '/\.star-btn\.starred svg/,/}/ s/fill: var(--accent);/fill: #FF9500;/' "$FILE"

# 3. Add CSS for mobile FAB and tab badge
# Find the mobile media query section and add styles
# This is trickier - we'll append to the end of the mobile media query

echo "
/* Mobile FAB */
.mobile-fab {
	position: fixed;
	bottom: 80px;
	right: 20px;
	width: 56px;
	height: 56px;
	border-radius: 50%;
	background: var(--accent);
	color: white;
	border: none;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	z-index: 90;
	transition: transform 0.2s, box-shadow 0.2s;
}

.mobile-fab:hover {
	transform: scale(1.05);
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.mobile-fab:active {
	transform: scale(0.95);
}

/* Tab Badge */
.tab-badge {
	position: absolute;
	top: 4px;
	right: 8px;
	background: #FF9500;
	color: white;
	font-size: 11px;
	font-weight: 600;
	padding: 2px 6px;
	border-radius: 10px;
	min-width: 18px;
	text-align: center;
}

.mobile-tab {
	position: relative;
}
" >> /tmp/mobile-styles.css

echo "✅ UI fixes applied!"
echo "Backup saved to: $BACKUP"
echo ""
echo "⚠️  NOTE: This script made basic changes."
echo "You still need to manually:"
echo "1. Add the mobile CSS from /tmp/mobile-styles.css to the @media (max-width: 768px) section"
echo "2. Fix the refresh icon SVG (see .gemini/remaining-ui-fixes.md)"
echo "3. Verify all changes look correct"
echo ""
echo "To restore backup if needed:"
echo "  cp '$BACKUP' '$FILE'"
