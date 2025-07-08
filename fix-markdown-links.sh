#!/bin/bash

# Script to convert relative markdown links to absolute GitHub URLs
# This fixes broken links when viewing files on GitHub with submodules

# Configuration
MAIN_REPO="https://github.com/sayhiben/streamwall-suite"
DEFAULT_BRANCH="main"

# Submodule mappings
declare -A SUBMODULES=(
  ["streamsource"]="https://github.com/streamwall/streamsource"
  ["livestream-link-monitor"]="https://github.com/streamwall/livestream-link-monitor"
  ["livesheet-updater"]="https://github.com/streamwall/livesheet-updater"
  ["streamwall"]="https://github.com/streamwall/streamwall"
)

# Function to convert relative path to GitHub URL
convert_to_github_url() {
  local relative_path="$1"
  local current_file="$2"
  local current_dir=$(dirname "$current_file")
  
  # Remove ./ prefix if present
  relative_path="${relative_path#./}"
  
  # Resolve the path
  local resolved_path=$(cd "$current_dir" && realpath --relative-to="$PWD" "$relative_path" 2>/dev/null || echo "$relative_path")
  
  # Check if path goes into a submodule
  for submodule in "${!SUBMODULES[@]}"; do
    if [[ "$resolved_path" == "$submodule/"* ]]; then
      local sub_path="${resolved_path#$submodule/}"
      echo "${SUBMODULES[$submodule]}/blob/$DEFAULT_BRANCH/$sub_path"
      return
    fi
  done
  
  # Otherwise, it's in the main repo
  echo "$MAIN_REPO/blob/$DEFAULT_BRANCH/$resolved_path"
}

# Process a single markdown file
process_file() {
  local file="$1"
  echo "Processing: $file"
  
  # Create a temporary file
  local temp_file=$(mktemp)
  local modified=false
  
  # Read file line by line
  while IFS= read -r line; do
    # Check if line contains markdown links
    if [[ "$line" =~ \[([^\]]+)\]\(([^)]+)\) ]]; then
      local new_line="$line"
      
      # Find all markdown links in the line
      while [[ "$new_line" =~ \[([^\]]+)\]\(([^)]+)\) ]]; do
        local full_match="${BASH_REMATCH[0]}"
        local link_text="${BASH_REMATCH[1]}"
        local link_url="${BASH_REMATCH[2]}"
        
        # Skip if already an absolute URL or anchor
        if [[ "$link_url" =~ ^https?:// ]] || [[ "$link_url" =~ ^# ]]; then
          break
        fi
        
        # Check if it's a relative path that might need conversion
        if [[ "$link_url" =~ \.\. ]] || [[ "$link_url" =~ ^\. ]] || [[ "${link_url%%/*}" == "streamsource" ]] || [[ "${link_url%%/*}" == "livestream-link-monitor" ]] || [[ "${link_url%%/*}" == "livesheet-updater" ]] || [[ "${link_url%%/*}" == "streamwall" ]]; then
          local absolute_url=$(convert_to_github_url "$link_url" "$file")
          new_line="${new_line//$full_match/[$link_text]($absolute_url)}"
          modified=true
          echo "  Converting: $link_url -> $absolute_url"
        fi
        
        # Move past this match to find next one
        new_line="${new_line#*$full_match}"
      done
      
      # Reconstruct the line
      line="${line%%\[*}${new_line}"
    fi
    
    echo "$line" >> "$temp_file"
  done < "$file"
  
  # Replace original file if modified
  if [ "$modified" = true ]; then
    mv "$temp_file" "$file"
    echo "  ✓ Updated $file"
  else
    rm "$temp_file"
  fi
}

# Main execution
main() {
  if [ $# -eq 0 ]; then
    # Find all markdown files
    echo "Finding all markdown files..."
    find . -name "*.md" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | while read -r file; do
      process_file "$file"
    done
  else
    # Process specific files
    for file in "$@"; do
      if [ -f "$file" ]; then
        process_file "$file"
      else
        echo "Warning: $file not found"
      fi
    done
  fi
}

main "$@"