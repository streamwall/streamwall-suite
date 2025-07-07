#!/bin/bash

# Migration script for moving from sayhiben/streamwall-project to streamwall/streamwall-suite

echo "🔄 Streamwall Repository Migration Script"
echo "========================================"
echo ""
echo "This script will help you migrate from the old repository location to the new one."
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository!"
    echo "Please run this script from your streamwall project directory."
    exit 1
fi

# Get current origin URL
CURRENT_ORIGIN=$(git remote get-url origin 2>/dev/null)

if [[ "$CURRENT_ORIGIN" == *"sayhiben/streamwall-project"* ]]; then
    echo "📍 Current repository: $CURRENT_ORIGIN"
    echo "🔄 Updating to new location..."
    
    # Update origin
    git remote set-url origin https://github.com/streamwall/streamwall-suite.git
    
    echo "✅ Remote updated successfully!"
    echo ""
    echo "New repository URL: $(git remote get-url origin)"
    
    echo ""
    echo "📥 Fetching latest changes..."
    git fetch origin
    
    echo ""
    echo "🔄 Updating submodules..."
    git submodule update --init --recursive
    
    echo ""
    echo "✅ Migration complete!"
    echo ""
    echo "Next steps:"
    echo "1. Pull latest changes: git pull origin main"
    echo "2. (Optional) Rename your local directory from 'streamwall-project' to 'streamwall-suite'"
    
elif [[ "$CURRENT_ORIGIN" == *"streamwall/streamwall-suite"* ]]; then
    echo "✅ Already using the new repository location!"
    echo "Current origin: $CURRENT_ORIGIN"
else
    echo "⚠️  Unexpected repository URL: $CURRENT_ORIGIN"
    echo ""
    echo "To manually update, run:"
    echo "git remote set-url origin https://github.com/streamwall/streamwall-suite.git"
fi

echo ""
echo "For more information, see MIGRATION_GUIDE.md"