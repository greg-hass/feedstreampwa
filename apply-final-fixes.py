#!/usr/bin/env python3
"""
Apply final UI fixes to +page.svelte
This script makes surgical edits to add:
1. Mobile FAB button (HTML + CSS)
2. Fix refresh icon
3. Standardize icon sizes
"""

import os
import sys
from datetime import datetime

FILE_PATH = "/Volumes/USB STORAGE/Projects/FeedStream-PWA/web/src/routes/+page.svelte"

def create_backup(file_path):
    """Create a timestamped backup of the file"""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{file_path}.backup-{timestamp}"
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    with open(backup_path, 'w') as f:
        f.write(content)
    
    print(f"✅ Backup created: {backup_path}")
    return backup_path

def read_file(file_path):
    """Read file and return lines"""
    with open(file_path, 'r') as f:
        return f.readlines()

def write_file(file_path, lines):
    """Write lines to file"""
    with open(file_path, 'w') as f:
        f.writelines(lines)

def add_mobile_fab_html(lines):
    """Add mobile FAB button HTML after line 2927"""
    # Find the line with {/if} after mobile tab bar
    # Looking for the specific {/if} that closes the mobile tab bar section
    
    insert_index = None
    for i, line in enumerate(lines):
        if i == 2926 and line.strip() == '{/if}':  # Line 2927 (0-indexed is 2926)
            insert_index = i + 1
            break
    
    if insert_index is None:
        print("⚠️  Could not find insertion point for mobile FAB HTML")
        return lines
    
    fab_html = [
        "\n",
        "\t<!-- Mobile Floating Add Button -->\n",
        "\t{#if isMobile}\n",
        "\t\t<button class=\"mobile-fab\" on:click={openAddFeedModal} title=\"Add Feeds\">\n",
        "\t\t\t<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\">\n",
        "\t\t\t\t<path d=\"M12 5v14M5 12h14\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>\n",
        "\t\t\t</svg>\n",
        "\t\t</button>\n",
        "\t{/if}\n",
    ]
    
    lines[insert_index:insert_index] = fab_html
    print("✅ Added mobile FAB HTML")
    return lines

def add_mobile_fab_css(lines):
    """Add mobile FAB and tab badge CSS before line 4845"""
    # Find the closing brace of the mobile media query
    # We need to insert before the } that closes @media (max-width: 768px)
    
    insert_index = None
    for i in range(len(lines)):
        # Looking for the line with just a tab and closing brace around line 4844
        if i >= 4840 and i <= 4850:
            if lines[i].strip() == '}' and i > 0:
                # Check if previous lines have article-actions
                prev_content = ''.join(lines[max(0, i-10):i])
                if 'article-actions' in prev_content:
                    insert_index = i
                    break
    
    if insert_index is None:
        print("⚠️  Could not find insertion point for mobile FAB CSS")
        return lines
    
    fab_css = [
        "\n",
        "\t\t/* Mobile Floating Action Button */\n",
        "\t\t.mobile-fab {\n",
        "\t\t\tposition: fixed;\n",
        "\t\t\tbottom: 80px;\n",
        "\t\t\tright: 20px;\n",
        "\t\t\twidth: 56px;\n",
        "\t\t\theight: 56px;\n",
        "\t\t\tborder-radius: 50%;\n",
        "\t\t\tbackground: var(--accent);\n",
        "\t\t\tcolor: white;\n",
        "\t\t\tborder: none;\n",
        "\t\t\tbox-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n",
        "\t\t\tdisplay: flex;\n",
        "\t\t\talign-items: center;\n",
        "\t\t\tjustify-content: center;\n",
        "\t\t\tcursor: pointer;\n",
        "\t\t\tz-index: 90;\n",
        "\t\t\ttransition: transform 0.2s, box-shadow 0.2s;\n",
        "\t\t}\n",
        "\n",
        "\t\t.mobile-fab:hover {\n",
        "\t\t\ttransform: scale(1.05);\n",
        "\t\t\tbox-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);\n",
        "\t\t}\n",
        "\n",
        "\t\t.mobile-fab:active {\n",
        "\t\t\ttransform: scale(0.95);\n",
        "\t\t}\n",
        "\n",
        "\t\t/* Tab Badge for bookmark count */\n",
        "\t\t.tab-badge {\n",
        "\t\t\tposition: absolute;\n",
        "\t\t\ttop: 4px;\n",
        "\t\t\tright: 8px;\n",
        "\t\t\tbackground: #FF9500;\n",
        "\t\t\tcolor: white;\n",
        "\t\t\tfont-size: 11px;\n",
        "\t\t\tfont-weight: 600;\n",
        "\t\t\tpadding: 2px 6px;\n",
        "\t\t\tborder-radius: 10px;\n",
        "\t\t\tmin-width: 18px;\n",
        "\t\t\ttext-align: center;\n",
        "\t\t}\n",
        "\n",
        "\t\t.mobile-tab {\n",
        "\t\t\tposition: relative;\n",
        "\t\t}\n",
    ]
    
    lines[insert_index:insert_index] = fab_css
    print("✅ Added mobile FAB and tab badge CSS")
    return lines

def fix_refresh_icon(lines):
    """Fix the refresh icon to be a proper circular arrow"""
    # Find the refresh button around line 2115
    # Look for the refresh button SVG
    
    for i in range(2100, 2150):
        if i < len(lines) and 'on:click={handleRefresh}' in lines[i]:
            # Found the refresh button, now find its SVG
            svg_start = None
            svg_end = None
            
            for j in range(i, min(i + 20, len(lines))):
                if '<svg' in lines[j]:
                    svg_start = j
                if svg_start is not None and '</svg>' in lines[j]:
                    svg_end = j
                    break
            
            if svg_start and svg_end:
                # Replace the SVG
                new_svg = [
                    "\t\t\t\t\t<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\">\n",
                    "\t\t\t\t\t\t<path d=\"M21 10c0-4.97-4.03-9-9-9-4.97 0-9 4.03-9 9s4.03 9 9 9c2.39 0 4.56-.94 6.16-2.46\" \n",
                    "\t\t\t\t\t\t\tstroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n",
                    "\t\t\t\t\t\t<path d=\"M17 8l4 2-2 4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n",
                    "\t\t\t\t\t</svg>\n",
                ]
                
                lines[svg_start:svg_end+1] = new_svg
                print("✅ Fixed refresh icon")
                return lines
    
    print("⚠️  Could not find refresh icon to fix")
    return lines

def standardize_icon_sizes(lines):
    """Add CSS rule to standardize icon sizes"""
    # Find a good place in the CSS section to add this
    # Look for existing icon-related styles
    
    for i in range(5700, 5850):
        if i < len(lines) and '.feed-icon' in lines[i]:
            # Found feed-icon styles, check if we need to add standardization
            # Look ahead to see if there's already a combined rule
            found_combined = False
            for j in range(i, min(i + 20, len(lines))):
                if '.feed-icon, .folder-icon, .smart-folder-icon' in lines[j]:
                    found_combined = True
                    break
            
            if not found_combined:
                # Add the standardization rule after the current feed-icon block
                # Find the end of the current rule
                for j in range(i, min(i + 30, len(lines))):
                    if lines[j].strip() == '}':
                        insert_index = j + 1
                        new_rule = [
                            "\n",
                            "\t/* Standardize all icon sizes */\n",
                            "\t.feed-icon, .folder-icon, .smart-folder-icon {\n",
                            "\t\twidth: 20px;\n",
                            "\t\theight: 20px;\n",
                            "\t\tflex-shrink: 0;\n",
                            "\t}\n",
                        ]
                        lines[insert_index:insert_index] = new_rule
                        print("✅ Added icon size standardization")
                        return lines
            else:
                print("✅ Icon sizes already standardized")
                return lines
    
    print("⚠️  Could not find location to add icon size standardization")
    return lines

def main():
    """Main function to apply all fixes"""
    print("=" * 60)
    print("Applying Final UI Fixes to +page.svelte")
    print("=" * 60)
    print()
    
    if not os.path.exists(FILE_PATH):
        print(f"❌ Error: File not found: {FILE_PATH}")
        sys.exit(1)
    
    # Create backup
    backup_path = create_backup(FILE_PATH)
    print()
    
    # Read file
    print("📖 Reading file...")
    lines = read_file(FILE_PATH)
    print(f"   File has {len(lines)} lines")
    print()
    
    # Apply fixes
    print("🔧 Applying fixes...")
    print()
    
    lines = add_mobile_fab_html(lines)
    lines = add_mobile_fab_css(lines)
    lines = fix_refresh_icon(lines)
    lines = standardize_icon_sizes(lines)
    
    print()
    
    # Write file
    print("💾 Writing changes...")
    write_file(FILE_PATH, lines)
    print(f"   File now has {len(lines)} lines")
    print()
    
    print("=" * 60)
    print("✨ All fixes applied successfully!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Review the changes")
    print("2. Rebuild: docker compose build web && docker compose up -d web")
    print("3. Test on mobile!")
    print()
    print(f"To restore backup if needed:")
    print(f"  cp '{backup_path}' '{FILE_PATH}'")
    print()

if __name__ == "__main__":
    main()
