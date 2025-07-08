#!/bin/bash

# Streamwall Configuration Validator
# This script validates the environment configuration before starting services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ENV_FILE="$SCRIPT_DIR/.env"

# Counters
ERRORS=0
WARNINGS=0

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a variable is set and not empty
check_required() {
    local var_name=$1
    local var_value=$2
    local description=$3
    
    if [ -z "$var_value" ] || [[ "$var_value" == *"change_in_production"* ]] || [[ "$var_value" == "your_"* ]]; then
        print_color "$RED" "✗ $var_name is not properly configured ($description)"
        ((ERRORS++))
        return 1
    else
        print_color "$GREEN" "✓ $var_name is set"
        return 0
    fi
}

# Function to check optional variables
check_optional() {
    local var_name=$1
    local var_value=$2
    local description=$3
    
    if [ -z "$var_value" ] || [[ "$var_value" == "your_"* ]] || [[ "$var_value" == *"_here" ]]; then
        print_color "$YELLOW" "⚠ $var_name is not configured ($description) - Optional"
        ((WARNINGS++))
        return 1
    else
        print_color "$GREEN" "✓ $var_name is configured"
        return 0
    fi
}

# Function to validate file exists
check_file() {
    local file_path=$1
    local description=$2
    local required=${3:-false}
    
    if [ -f "$file_path" ]; then
        print_color "$GREEN" "✓ $description exists at: $file_path"
        return 0
    else
        if [ "$required" = true ]; then
            print_color "$RED" "✗ $description not found at: $file_path"
            ((ERRORS++))
        else
            print_color "$YELLOW" "⚠ $description not found at: $file_path - Optional"
            ((WARNINGS++))
        fi
        return 1
    fi
}

# Function to validate port availability
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_color "$RED" "✗ Port $port is already in use (needed for $service)"
        ((ERRORS++))
        return 1
    else
        print_color "$GREEN" "✓ Port $port is available for $service"
        return 0
    fi
}

# Function to validate URL format
validate_url() {
    local url=$1
    local var_name=$2
    
    if [[ "$url" =~ ^https?://[a-zA-Z0-9.-]+([:/][a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?$ ]]; then
        print_color "$GREEN" "✓ $var_name has valid URL format"
        return 0
    else
        print_color "$RED" "✗ $var_name has invalid URL format: $url"
        ((ERRORS++))
        return 1
    fi
}

# Main validation
main() {
    print_color "$BLUE" "🔍 Streamwall Configuration Validator"
    print_color "$BLUE" "===================================="
    echo
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        print_color "$RED" "Error: .env file not found!"
        print_color "$YELLOW" "Run ./setup-wizard.sh to create one"
        exit 1
    fi
    
    # Source the environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    print_color "$BLUE" "Checking Required Configuration..."
    echo
    
    # Core environment
    check_required "NODE_ENV" "$NODE_ENV" "Node.js environment"
    check_required "RAILS_ENV" "$RAILS_ENV" "Rails environment"
    
    # Database
    check_required "POSTGRES_USER" "$POSTGRES_USER" "PostgreSQL username"
    check_required "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD" "PostgreSQL password"
    check_required "POSTGRES_DB" "$POSTGRES_DB" "PostgreSQL database name"
    
    # Security keys
    check_required "SECRET_KEY_BASE" "$SECRET_KEY_BASE" "Rails secret key"
    check_required "JWT_SECRET" "$JWT_SECRET" "JWT signing secret"
    check_required "STREAMSOURCE_API_KEY" "$STREAMSOURCE_API_KEY" "API authentication key"
    
    # Validate key lengths
    if [ ${#SECRET_KEY_BASE} -lt 30 ]; then
        print_color "$RED" "✗ SECRET_KEY_BASE is too short (minimum 30 characters)"
        ((ERRORS++))
    fi
    
    if [ ${#JWT_SECRET} -lt 30 ]; then
        print_color "$RED" "✗ JWT_SECRET is too short (minimum 30 characters)"
        ((ERRORS++))
    fi
    
    echo
    print_color "$BLUE" "Checking Optional Configuration..."
    echo
    
    # Discord configuration
    check_optional "DISCORD_TOKEN" "$DISCORD_TOKEN" "Discord bot token"
    check_optional "DISCORD_CHANNEL_ID" "$DISCORD_CHANNEL_ID" "Discord channel to monitor"
    
    # Twitch configuration
    check_optional "TWITCH_CHANNEL" "$TWITCH_CHANNEL" "Twitch channel to monitor"
    
    # Google Sheets configuration
    check_optional "GOOGLE_SHEET_ID" "$GOOGLE_SHEET_ID" "Google Sheet ID"
    
    echo
    print_color "$BLUE" "Checking Service URLs..."
    echo
    
    # Validate URLs
    if [ -n "$STREAMSOURCE_API_URL" ]; then
        validate_url "$STREAMSOURCE_API_URL" "STREAMSOURCE_API_URL"
    fi
    
    echo
    print_color "$BLUE" "Checking Ports..."
    echo
    
    # Check port availability
    check_port "${STREAMSOURCE_PORT:-3000}" "StreamSource API"
    check_port "${POSTGRES_PORT:-5432}" "PostgreSQL"
    check_port "${REDIS_PORT:-6379}" "Redis"
    check_port "${LIVESTREAM_MONITOR_PORT:-3001}" "Livestream Monitor"
    
    echo
    print_color "$BLUE" "Checking Required Files..."
    echo
    
    # Check for credential files
    if [ -n "$GOOGLE_SHEET_ID" ]; then
        check_file "$SCRIPT_DIR/livestream-link-monitor/creds.json" "Google credentials for livestream-monitor" false
        check_file "$SCRIPT_DIR/livesheet-checker/creds.json" "Google credentials for livesheet-checker" false
    fi
    
    # Check submodules
    if [ ! -d "$SCRIPT_DIR/streamsource/.git" ]; then
        print_color "$RED" "✗ StreamSource submodule not initialized"
        print_color "$YELLOW" "  Run: git submodule update --init --recursive"
        ((ERRORS++))
    else
        print_color "$GREEN" "✓ StreamSource submodule initialized"
    fi
    
    echo
    print_color "$BLUE" "Checking Docker..."
    echo
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        print_color "$RED" "✗ Docker is not running"
        ((ERRORS++))
    else
        print_color "$GREEN" "✓ Docker is running"
    fi
    
    # Summary
    echo
    print_color "$BLUE" "========================================="
    if [ $ERRORS -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            print_color "$GREEN" "✓ Configuration is valid! No issues found."
        else
            print_color "$GREEN" "✓ Configuration is valid with $WARNINGS warning(s)"
            print_color "$YELLOW" "  Optional features may not be available"
        fi
        echo
        print_color "$BLUE" "You can start the services with:"
        print_color "$BLUE" "  docker compose up -d"
        exit 0
    else
        print_color "$RED" "✗ Configuration has $ERRORS error(s) and $WARNINGS warning(s)"
        print_color "$YELLOW" "  Please fix the errors before starting services"
        echo
        print_color "$BLUE" "Run ./setup-wizard.sh to reconfigure"
        exit 1
    fi
}

# Run validation
main "$@"