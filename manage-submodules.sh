#!/bin/bash

# Submodule Management Script for Streamwall Ecosystem
# This script helps manage git submodules

set -e

SUBMODULES=("streamsource" "livestream-link-monitor" "livesheet-updater" "streamwall")

function show_help() {
    cat << EOF
Streamwall Submodule Manager

Usage: ./manage-submodules.sh [command]

Commands:
    status      Show status of all submodules
    update      Update all submodules to latest commit
    checkout    Checkout specific branch for all submodules
    fetch       Fetch latest changes for all submodules
    sync        Sync submodule URLs with .gitmodules
    help        Show this help message

Examples:
    ./manage-submodules.sh status
    ./manage-submodules.sh update
    ./manage-submodules.sh checkout main
EOF
}

function check_status() {
    echo "🔍 Checking submodule status..."
    echo ""
    git submodule status
    echo ""
    
    for submodule in "${SUBMODULES[@]}"; do
        echo "📦 $submodule:"
        if [ -d "$submodule/.git" ]; then
            cd "$submodule"
            echo "   Branch: $(git branch --show-current)"
            echo "   Status: $(git status --porcelain | wc -l) uncommitted changes"
            cd ..
        else
            echo "   ⚠️  Not initialized"
        fi
        echo ""
    done
}

function update_submodules() {
    echo "📥 Updating all submodules..."
    git submodule update --init --recursive
    echo "✅ Submodules updated"
}

function checkout_branch() {
    if [ -z "$1" ]; then
        echo "❌ Please specify a branch name"
        echo "Usage: ./manage-submodules.sh checkout <branch-name>"
        exit 1
    fi
    
    branch=$1
    echo "🔀 Checking out branch '$branch' for all submodules..."
    
    for submodule in "${SUBMODULES[@]}"; do
        echo "   $submodule..."
        if [ -d "$submodule/.git" ]; then
            cd "$submodule"
            if git show-ref --verify --quiet "refs/heads/$branch"; then
                git checkout "$branch"
            else
                echo "   ⚠️  Branch '$branch' doesn't exist in $submodule"
            fi
            cd ..
        fi
    done
    
    echo "✅ Done"
}

function fetch_all() {
    echo "🔄 Fetching latest changes for all submodules..."
    
    for submodule in "${SUBMODULES[@]}"; do
        echo "   $submodule..."
        if [ -d "$submodule/.git" ]; then
            cd "$submodule"
            git fetch
            cd ..
        fi
    done
    
    echo "✅ Fetch complete"
}

function sync_urls() {
    echo "🔗 Syncing submodule URLs with .gitmodules..."
    git submodule sync
    echo "✅ URLs synced"
}

# Main script logic
case "$1" in
    status)
        check_status
        ;;
    update)
        update_submodules
        ;;
    checkout)
        checkout_branch "$2"
        ;;
    fetch)
        fetch_all
        ;;
    sync)
        sync_urls
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac