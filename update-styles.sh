#!/bin/bash
# Script to update +page.svelte styles for compact feed reader design

cd "$(dirname "$0")"

# Create backup
cp web/src/routes/+page.svelte web/src/routes/+page.svelte.backup

# Apply comprehensive style updates using sed
sed -i '' '
# Update item cards - reduce padding and remove glow
s/padding: 1\.5rem;/padding: 0.75rem 1rem;/g
s/rgba(102, 126, 234, 0\.2)/rgba(0, 230, 118, 0.05)/g
s/rgba(102, 126, 234, 0\.4)/var(--accent)/g

# Update font sizes
s/font-size: 1\.1rem;/font-size: 0.95rem;/g
s/font-size: 1\.5rem;/font-size: 1.3rem;/g

# Update borders
s/border: 1px solid rgba(255, 255, 255, 0\.1);/border: 1px solid var(--border);/g

# Update hover transforms
s/transform: translateY(-2px);/transform: translateY(-1px);/g

# Update border radius
s/border-radius: 12px;/border-radius: 6px;/g
s/border-radius: 8px;/border-radius: 4px;/g
' web/src/routes/+page.svelte

echo "Styles updated successfully"
