#!/bin/bash

# Setup script for Streamwall ecosystem submodules

echo "Setting up Streamwall ecosystem..."

# Initialize submodules if .gitmodules exists
if [ -f ".gitmodules" ]; then
    git submodule init
    git submodule update --recursive
else
    echo "No .gitmodules file found. Copy .gitmodules.example and update with your repository URLs."
    exit 1
fi

# Clone missing repositories
declare -A repos=(
    ["livestream-link-monitor"]="https://github.com/yourusername/livestream-link-monitor.git"
    ["livesheet-updater"]="https://github.com/yourusername/livesheet-updater.git"
    ["streamsource"]="https://github.com/yourusername/streamsource.git"
    ["streamwall"]="https://github.com/yourusername/streamwall.git"
)

for dir in "${!repos[@]}"; do
    if [ ! -d "$dir/.git" ]; then
        echo "Adding $dir as submodule..."
        git submodule add "${repos[$dir]}" "$dir"
    fi
done

echo "Updating all submodules to latest..."
git submodule update --remote --merge

echo "Setup complete!"