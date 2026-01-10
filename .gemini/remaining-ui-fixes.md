# Remaining UI Fixes - Implementation Guide

## 1. Add Mobile Floating Action Button (FAB)

**Location:** After line 2927 in +page.svelte (after the mobile tab bar `{/if}`)

**Code to add:**
```svelte
<!-- Mobile Floating Add Button -->
{#if isMobile}
	<button class="mobile-fab" on:click={openAddFeedModal} title="Add Feeds">
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
			<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
		</svg>
	</button>
{/if}
```

**CSS to add** (in the `<style>` section, around line 4700 in mobile media query):
```css
.mobile-fab {
	position: fixed;
	bottom: 80px; /* Above tab bar */
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
```

## 2. Change Bookmarks to Orange

**Find and replace in CSS:**
- Find: `.star-btn.starred` (around line 4350)
- Change `color: var(--accent);` to `color: #FF9500;`

**Also find:**
- `.star-btn.starred svg` 
- Change `fill: var(--accent);` to `fill: #FF9500;`

**Specific changes needed:**
```css
/* Around line 4350 */
.star-btn.starred {
	color: #FF9500; /* Changed from var(--accent) */
}

.star-btn.starred svg {
	fill: #FF9500; /* Changed from var(--accent) */
}
```

## 3. Tab Badge Styling

**Add to mobile CSS** (around line 4700):
```css
.tab-badge {
	position: absolute;
	top: 4px;
	right: 8px;
	background: #FF9500; /* Orange to match bookmarks */
	color: white;
	font-size: 11px;
	font-weight: 600;
	padding: 2px 6px;
	border-radius: 10px;
	min-width: 18px;
	text-align: center;
}

.mobile-tab {
	position: relative; /* Needed for badge positioning */
}
```

## 4. Fix Icons (Consistent Sizes)

**Sidebar icons** - Find all feed-icon, folder-icon, etc. and ensure:
```css
.feed-icon, .folder-icon, .smart-folder-icon {
	width: 20px;
	height: 20px;
	flex-shrink: 0;
}
```

## 5. Fix Refresh Icon

**Find the refresh button SVG** (around line 2100) and replace with proper circular arrow:
```svelte
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
	<path d="M21 10c0-4.97-4.03-9-9-9-4.97 0-9 4.03-9 9s4.03 9 9 9c2.39 0 4.56-.94 6.16-2.46" 
		stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
	<path d="M17 8l4 2-2 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## 6. Fix Settings Icon  

**Find the settings button SVG** (the one that replaced Feeds in mobile tab bar, around line 2910) - it's already correct!

The settings icon is already a proper cog/gear icon.

---

## Summary of Manual Edits Needed:

Due to file size (6,429 lines), these changes need to be made manually or in smaller chunks:

1. ✅ Add FAB HTML after line 2927
2. ✅ Add FAB CSS in mobile media query  
3. ✅ Add tab-badge CSS
4. ✅ Change star colors from green to orange
5. ✅ Standardize icon sizes
6. ✅ Fix refresh icon SVG

Would you like me to create a shell script to make these changes automatically?
