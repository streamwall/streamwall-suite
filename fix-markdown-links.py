#!/usr/bin/env python3
"""
Convert relative markdown links to absolute GitHub URLs.
This fixes broken links when viewing files on GitHub with submodules.
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional

# Configuration
MAIN_REPO = "https://github.com/sayhiben/streamwall-suite"
DEFAULT_BRANCH = "main"

# Submodule mappings
SUBMODULES = {
    "streamsource": "https://github.com/streamwall/streamsource",
    "livestream-link-monitor": "https://github.com/streamwall/livestream-link-monitor",
    "livesheet-updater": "https://github.com/streamwall/livesheet-updater",
    "streamwall": "https://github.com/streamwall/streamwall"
}

def convert_to_github_url(relative_path: str, current_file: Path) -> str:
    """Convert a relative path to an absolute GitHub URL."""
    # Remove ./ prefix if present
    if relative_path.startswith('./'):
        relative_path = relative_path[2:]
    
    # Resolve the path relative to the current file
    current_dir = current_file.parent
    try:
        # Use pathlib to resolve the path
        resolved = (current_dir / relative_path).resolve()
        # Make it relative to the repo root
        repo_root = Path.cwd()
        resolved_relative = resolved.relative_to(repo_root)
        resolved_path = str(resolved_relative).replace('\\', '/')
    except (ValueError, OSError):
        # If resolution fails, work with the string directly
        resolved_path = relative_path
    
    # Check if path goes into a submodule
    path_parts = resolved_path.split('/')
    if path_parts and path_parts[0] in SUBMODULES:
        submodule = path_parts[0]
        sub_path = '/'.join(path_parts[1:])
        return f"{SUBMODULES[submodule]}/blob/{DEFAULT_BRANCH}/{sub_path}"
    
    # Otherwise, it's in the main repo
    return f"{MAIN_REPO}/blob/{DEFAULT_BRANCH}/{resolved_path}"

def process_markdown_file(file_path: Path) -> bool:
    """Process a single markdown file and update links."""
    print(f"Processing: {file_path}")
    
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  Error reading file: {e}")
        return False
    
    modified = False
    
    # Pattern to match markdown links: [text](url)
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    def replace_link(match):
        nonlocal modified
        text, url = match.groups()
        
        # Skip if already an absolute URL or anchor
        if url.startswith(('http://', 'https://', '#')):
            return match.group(0)
        
        # Check if it's a relative path that might need conversion
        needs_conversion = (
            '../' in url or
            url.startswith('./') or
            any(url.startswith(f"{submodule}/") for submodule in SUBMODULES) or
            url.split('/')[0] in SUBMODULES
        )
        
        if needs_conversion:
            absolute_url = convert_to_github_url(url, file_path)
            print(f"  Converting: {url} -> {absolute_url}")
            modified = True
            return f"[{text}]({absolute_url})"
        
        return match.group(0)
    
    # Replace all links in the content
    new_content = link_pattern.sub(replace_link, content)
    
    if modified:
        try:
            file_path.write_text(new_content, encoding='utf-8')
            print(f"  ✓ Updated {file_path}")
        except Exception as e:
            print(f"  Error writing file: {e}")
            return False
    
    return modified

def find_markdown_files() -> list[Path]:
    """Find all markdown files in the repository."""
    markdown_files = []
    
    for pattern in ['**/*.md', '**/*.MD']:
        for file_path in Path('.').glob(pattern):
            # Skip node_modules and .git directories
            if any(part in file_path.parts for part in ['node_modules', '.git']):
                continue
            markdown_files.append(file_path)
    
    return markdown_files

def main():
    """Main entry point."""
    args = sys.argv[1:]
    
    if args:
        # Process specific files
        files = [Path(arg) for arg in args]
    else:
        # Find all markdown files
        print("Finding all markdown files...")
        files = find_markdown_files()
    
    print(f"Found {len(files)} markdown files to process\n")
    
    updated_count = 0
    for file_path in files:
        if file_path.exists() and file_path.is_file():
            if process_markdown_file(file_path):
                updated_count += 1
        else:
            print(f"Warning: {file_path} not found or not a file")
    
    print(f"\nUpdated {updated_count} files")

if __name__ == "__main__":
    main()