#!/bin/bash

# Streamwall Ecosystem Setup Wizard
# This script guides you through setting up the Streamwall ecosystem with Docker Compose
# Compatible with macOS, Linux, and Windows WSL

set -e

# Colors for output (ANSI codes work across all platforms)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Platform detection
detect_platform() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            echo "wsl"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "windows-git-bash"
    else
        echo "unknown"
    fi
}

PLATFORM=$(detect_platform)

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

# Cross-platform sed function
sed_inplace() {
    local file="$1"
    shift
    if [[ "$PLATFORM" == "macos" ]]; then
        sed -i '' "$@" "$file"
    else
        sed -i "$@" "$file"
    fi
}

# Cross-platform mktemp function
mktemp_compat() {
    if [[ "$PLATFORM" == "macos" ]]; then
        mktemp -t streamwall.XXXXXX
    else
        mktemp
    fi
}

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print section headers
print_header() {
    echo
    print_color "$BLUE" "========================================="
    print_color "$BLUE" "$1"
    print_color "$BLUE" "========================================="
    echo
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("Docker")
    else
        print_color "$GREEN" "✓ Docker installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("Docker Compose")
    else
        print_color "$GREEN" "✓ Docker Compose installed"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("Git")
    else
        print_color "$GREEN" "✓ Git installed"
    fi
    
    # Check Make
    if ! command -v make &> /dev/null; then
        missing_deps+=("Make (optional but recommended)")
    else
        print_color "$GREEN" "✓ Make installed"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_color "$RED" "Missing prerequisites: ${missing_deps[*]}"
        print_color "$YELLOW" "Please install these tools before continuing."
        exit 1
    fi
    
    echo
    print_color "$GREEN" "All prerequisites installed!"
}

# Function to initialize git submodules
init_submodules() {
    print_header "Initializing Git Submodules"
    
    if [ -f "$SCRIPT_DIR/.gitmodules" ]; then
        print_color "$YELLOW" "Initializing submodules..."
        git submodule update --init --recursive
        print_color "$GREEN" "✓ Submodules initialized"
    else
        print_color "$YELLOW" "No submodules found, skipping..."
    fi
}

# Function to generate secure random string
generate_secret() {
    openssl rand -hex 32 2>/dev/null || tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 64 | head -n 1
}

# Function to prompt for value with default
prompt_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    local secret=${4:-false}
    
    if [ "$secret" = true ]; then
    read -rs -p "$prompt [$default]: " value
        echo  # New line after secret input
    else
    read -r -p "$prompt [$default]: " value
    fi
    
    value=${value:-$default}
    eval "$var_name='$value'"
}

# Function to setup environment file
setup_environment() {
    print_header "Environment Configuration"
    
    if [ -f "$ENV_FILE" ]; then
        print_color "$YELLOW" "Existing .env file found!"
    read -r -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            print_color "$BLUE" "Keeping existing configuration."
            return
        fi
        # Backup existing file
        cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        print_color "$GREEN" "✓ Backed up existing .env file"
    fi
    
    # Copy example file
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
    else
        print_color "$RED" "Error: .env.example file not found!"
        exit 1
    fi
    
    print_color "$YELLOW" "Let's configure your environment..."
    echo
    
    # Setup mode selection
    print_color "$BLUE" "Select setup mode:"
    echo "1) Quick Setup (minimal configuration, good defaults)"
    echo "2) Full Setup (configure all services)"
    echo "3) Development Setup (includes debugging options)"
    read -r -p "Choice [1]: " setup_mode
    setup_mode=${setup_mode:-1}
    
    # Generate secure keys
    print_color "$YELLOW" "Generating secure keys..."
    SECRET_KEY_BASE=$(generate_secret)
    JWT_SECRET=$(generate_secret)
    STREAMSOURCE_API_KEY=$(generate_secret)
    
    # Update .env file with generated values
    sed_inplace "$ENV_FILE" "s|SECRET_KEY_BASE=.*|SECRET_KEY_BASE=$SECRET_KEY_BASE|"
    sed_inplace "$ENV_FILE" "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|"
    sed_inplace "$ENV_FILE" "s|STREAMSOURCE_API_KEY=.*|STREAMSOURCE_API_KEY=$STREAMSOURCE_API_KEY|"
    
    # Set environment based on mode
    case $setup_mode in
        3)  # Development
            sed_inplace "$ENV_FILE" "s|NODE_ENV=.*|NODE_ENV=development|"
            sed_inplace "$ENV_FILE" "s|RAILS_ENV=.*|RAILS_ENV=development|"
            ;;
        *)  # Quick or Full
            sed_inplace "$ENV_FILE" "s|NODE_ENV=.*|NODE_ENV=production|"
            sed_inplace "$ENV_FILE" "s|RAILS_ENV=.*|RAILS_ENV=production|"
            ;;
    esac
    
    if [ "$setup_mode" != "1" ]; then
        echo
        print_color "$BLUE" "Database Configuration:"
        prompt_with_default "PostgreSQL username" "streamwall" POSTGRES_USER
        prompt_with_default "PostgreSQL password" "streamwall_pass" POSTGRES_PASSWORD true
        prompt_with_default "PostgreSQL database" "streamwall_production" POSTGRES_DB
        
        sed_inplace "$ENV_FILE" "s|POSTGRES_USER=.*|POSTGRES_USER=$POSTGRES_USER|"
        sed_inplace "$ENV_FILE" "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|"
        sed_inplace "$ENV_FILE" "s|POSTGRES_DB=.*|POSTGRES_DB=$POSTGRES_DB|"
    fi
    
    if [ "$setup_mode" == "2" ]; then
        echo
        print_color "$BLUE" "Discord Configuration (for livestream-link-monitor):"
        prompt_with_default "Discord Bot Token (leave empty to skip)" "" DISCORD_TOKEN true
        prompt_with_default "Discord Channel ID" "" DISCORD_CHANNEL_ID
        
        if [ -n "$DISCORD_TOKEN" ]; then
            sed_inplace "$ENV_FILE" "s|DISCORD_TOKEN=.*|DISCORD_TOKEN=$DISCORD_TOKEN|"
            sed_inplace "$ENV_FILE" "s|DISCORD_CHANNEL_ID=.*|DISCORD_CHANNEL_ID=$DISCORD_CHANNEL_ID|"
        fi
        
        echo
        print_color "$BLUE" "Google Sheets Configuration:"
        prompt_with_default "Google Sheet ID (leave empty to skip)" "" GOOGLE_SHEET_ID
        
        if [ -n "$GOOGLE_SHEET_ID" ]; then
            sed_inplace "$ENV_FILE" "s|GOOGLE_SHEET_ID=.*|GOOGLE_SHEET_ID=$GOOGLE_SHEET_ID|"
            print_color "$YELLOW" "Note: You'll need to place your Google credentials JSON file at:"
            print_color "$YELLOW" "  livestream-link-monitor/creds.json"
            print_color "$YELLOW" "  livesheet-updater/creds.json"
        fi
    fi
    
    # Clean up backup files
    
    
    print_color "$GREEN" "✓ Environment configuration complete!"
}

# Function to create necessary directories
create_directories() {
    print_header "Creating Required Directories"
    
    local dirs=(
        "postgres-data"
        "redis-data"
        "logs"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$SCRIPT_DIR/$dir" ]; then
            mkdir -p "$SCRIPT_DIR/$dir"
            print_color "$GREEN" "✓ Created $dir/"
        else
            print_color "$BLUE" "  $dir/ already exists"
        fi
    done
}

# Function to setup StreamSource
setup_streamsource() {
    print_header "Setting up StreamSource"
    
    if [ -d "$SCRIPT_DIR/streamsource" ]; then
        cd "$SCRIPT_DIR/streamsource"
        
        # Create .env file for StreamSource if needed
        if [ ! -f ".env" ] && [ -f ".env.example" ]; then
            cp .env.example .env
            # Copy relevant values from root .env
            if [ -f "$ENV_FILE" ]; then
                source "$ENV_FILE"
                sed_inplace "s|SECRET_KEY_BASE=.*|SECRET_KEY_BASE=$SECRET_KEY_BASE|" .env
                sed_inplace "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
                sed_inplace "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}|" .env
            fi
            print_color "$GREEN" "✓ Created StreamSource .env file"
        fi
        
        cd "$SCRIPT_DIR"
    fi
}

# Function to setup other services
setup_services() {
    print_header "Setting up Services"
    
    # Setup livestream-link-monitor
    if [ -d "$SCRIPT_DIR/livestream-link-monitor" ]; then
        cd "$SCRIPT_DIR/livestream-link-monitor"
        if [ ! -f ".env" ] && [ -f ".env.example" ]; then
            cp .env.example .env
            # Copy API key from root config
            if [ -f "$ENV_FILE" ]; then
                source "$ENV_FILE"
                sed_inplace "s|STREAMSOURCE_API_KEY=.*|STREAMSOURCE_API_KEY=$STREAMSOURCE_API_KEY|" .env
                sed_inplace "s|STREAMSOURCE_API_URL=.*|STREAMSOURCE_API_URL=http://streamsource:3000/api/v1|" .env
            fi
            print_color "$GREEN" "✓ Created livestream-link-monitor .env file"
        fi
        cd "$SCRIPT_DIR"
    fi
    
    # Setup livesheet-updater
    if [ -d "$SCRIPT_DIR/livesheet-updater" ]; then
        cd "$SCRIPT_DIR/livesheet-updater"
        # This service uses creds.json, create a placeholder if needed
        if [ ! -f "creds.json" ]; then
            echo '{"note": "Place your Google service account credentials here"}' > creds.json
            print_color "$YELLOW" "  Created placeholder creds.json for livesheet-updater"
        fi
        cd "$SCRIPT_DIR"
    fi
}

# Function to start services
start_services() {
    print_header "Starting Services"
    
    print_color "$YELLOW" "Starting Docker containers..."
    
    # Use docker compose v2 if available, otherwise fall back to docker-compose
    if docker compose version &> /dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi
    
    print_color "$GREEN" "✓ Services starting..."
    echo
    print_color "$YELLOW" "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker compose exec -T postgres pg_isready -U ${POSTGRES_USER:-streamwall} &> /dev/null; then
            print_color "$GREEN" "✓ PostgreSQL is ready"
            break
        fi
        retries=$((retries - 1))
        sleep 2
    done
    
    # Wait for StreamSource
    retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:3000/health &> /dev/null; then
            print_color "$GREEN" "✓ StreamSource API is ready"
            break
        fi
        retries=$((retries - 1))
        sleep 2
    done
    
    # Run database migrations
    print_color "$YELLOW" "Running database migrations..."
    docker compose exec -T streamsource bundle exec rails db:create db:migrate
    print_color "$GREEN" "✓ Database setup complete"
}

# Function to create admin account
create_admin_account() {
    print_header "Creating Admin Account"
    
    print_color "$YELLOW" "Let's create your StreamSource admin account..."
    echo
    
    # Get admin email
    local admin_email
    while true; do
    read -r -p "Admin email address: " admin_email
        if [[ "$admin_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            break
        else
            print_color "$RED" "Invalid email format. Please try again."
        fi
    done
    
    # Generate secure password
    local admin_password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    print_color "$YELLOW" "Creating admin account..."
    
    # Create the admin user via Rails console
    local create_user_cmd="User.create!(email: '$admin_email', password: '$admin_password', admin: true, confirmed_at: Time.current)"
    
    if docker compose exec -T streamsource bundle exec rails runner "$create_user_cmd" 2>/dev/null; then
        print_color "$GREEN" "✓ Admin account created successfully!"
        echo
        print_color "$BLUE" "====== IMPORTANT: Save these credentials! ======"
        print_color "$YELLOW" "Email: $admin_email"
        print_color "$YELLOW" "Password: $admin_password"
        print_color "$BLUE" "=============================================="
        echo
        print_color "$YELLOW" "You can change your password after logging in."
        
        # Save to a secure file
        local creds_file="$SCRIPT_DIR/admin-credentials.txt"
        echo "StreamSource Admin Credentials" > "$creds_file"
        echo "Created: $(date)" >> "$creds_file"
        echo "Email: $admin_email" >> "$creds_file"
        echo "Password: $admin_password" >> "$creds_file"
        echo "" >> "$creds_file"
        echo "Please change this password after first login!" >> "$creds_file"
        chmod 600 "$creds_file"
        
        print_color "$GREEN" "✓ Credentials saved to: $creds_file"
        print_color "$YELLOW" "  (This file has restricted permissions for security)"
    else
        print_color "$RED" "Failed to create admin account. You can create it manually later."
    fi
}

# Function to configure Discord bot
configure_discord_bot() {
    print_header "Discord Bot Configuration"
    
    read -r -p "Do you want to configure the Discord bot? (Y/n): " configure_discord
    configure_discord=${configure_discord:-Y}
    
    if [[ ! "$configure_discord" =~ ^[Yy]$ ]]; then
        print_color "$BLUE" "Skipping Discord configuration."
        return
    fi
    
    print_color "$YELLOW" "To configure the Discord bot, you'll need:"
    echo "  1. A Discord Bot Token"
    echo "  2. The Channel ID to monitor"
    echo
    print_color "$BLUE" "Step 1: Create a Discord Bot"
    echo "  1. Go to https://discord.com/developers/applications"
    echo "  2. Click 'New Application' and give it a name (e.g., 'Streamwall Bot')"
    echo "  3. Go to the 'Bot' section in the left sidebar"
    echo "  4. Click 'Add Bot'"
    echo "  5. Under 'Token', click 'Copy' to copy your bot token"
    echo
    
    # Get Discord token
    local discord_token
    while true; do
    read -rs -p "Paste your Discord bot token (input hidden): " discord_token
        echo
        if [ -n "$discord_token" ]; then
            break
        else
            print_color "$RED" "Token cannot be empty. Please try again."
        fi
    done
    
    print_color "$BLUE" "Step 2: Add Bot to Your Server"
    echo "  1. In the Discord Developer Portal, go to 'OAuth2' > 'URL Generator'"
    echo "  2. Select scopes: 'bot'"
    echo "  3. Select bot permissions: 'Read Messages', 'Send Messages', 'Read Message History'"
    echo "  4. Copy the generated URL and open it in your browser"
    echo "  5. Select your server and authorize the bot"
    echo
    read -r -p "Press Enter when you've added the bot to your server..."
    
    print_color "$BLUE" "Step 3: Get Channel ID"
    echo "  1. In Discord, go to User Settings > Advanced"
    echo "  2. Enable 'Developer Mode'"
    echo "  3. Right-click on the channel you want to monitor"
    echo "  4. Click 'Copy ID'"
    echo
    
    # Get Channel ID
    local channel_id
    while true; do
    read -r -p "Paste your Discord channel ID: " channel_id
        if [[ "$channel_id" =~ ^[0-9]+$ ]]; then
            break
        else
            print_color "$RED" "Invalid channel ID. Please enter numbers only."
        fi
    done
    
    # Update .env file
    print_color "$YELLOW" "Updating configuration..."
    sed_inplace "$ENV_FILE" "s|DISCORD_TOKEN=.*|DISCORD_TOKEN=$discord_token|"
    sed_inplace "$ENV_FILE" "s|DISCORD_CHANNEL_ID=.*|DISCORD_CHANNEL_ID=$channel_id|"
    
    
    # Also update livestream-link-monitor .env if it exists
    if [ -f "$SCRIPT_DIR/livestream-link-monitor/.env" ]; then
        sed_inplace "$SCRIPT_DIR/livestream-link-monitor/.env" "s|DISCORD_TOKEN=.*|DISCORD_TOKEN=$discord_token|"
        sed_inplace "$SCRIPT_DIR/livestream-link-monitor/.env" "s|DISCORD_CHANNEL_ID=.*|DISCORD_CHANNEL_ID=$channel_id|"
    fi
    
    print_color "$GREEN" "✓ Discord bot configured successfully!"
    print_color "$YELLOW" "The bot will start monitoring the specified channel for livestream links."
    
    # Restart the service to apply changes
    print_color "$YELLOW" "Restarting livestream-monitor service..."
    docker compose restart livestream-monitor
    print_color "$GREEN" "✓ Service restarted"
}

# Function to show final instructions
show_final_instructions() {
    print_header "Setup Complete! 🎉"
    
    print_color "$GREEN" "The Streamwall ecosystem is now running!"
    echo
    print_color "$BLUE" "Services available at:"
    echo "  • StreamSource API: http://localhost:3000"
    echo "  • PostgreSQL: localhost:5432"
    echo "  • Redis: localhost:6379"
    if [ -n "$DISCORD_TOKEN" ]; then
        echo "  • Discord Bot: Active and monitoring"
    fi
    echo
    print_color "$BLUE" "Useful commands:"
    echo "  • View logs: docker compose logs -f"
    echo "  • Stop services: docker compose down"
    echo "  • Restart services: docker compose restart"
    echo "  • Run tests: make test"
    echo "  • Validate config: ./validate-config.sh"
    echo
    
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
        if [ -n "$STREAMSOURCE_API_KEY" ]; then
            print_color "$YELLOW" "Your StreamSource API key: $STREAMSOURCE_API_KEY"
            print_color "$YELLOW" "(This key is used for API authentication between services)"
        fi
    fi
    
    if [ -f "$SCRIPT_DIR/admin-credentials.txt" ]; then
        echo
        print_color "$YELLOW" "Admin credentials have been saved to: admin-credentials.txt"
        print_color "$YELLOW" "Please store these securely and delete the file after saving elsewhere."
    fi
    
    echo
    print_color "$GREEN" "Happy streaming! 🚀"
}

# Function to show main menu
show_main_menu() {
    print_header "Setup Mode Selection"
    
    print_color "$BLUE" "Choose setup mode:"
    echo "1) Full Setup - Configure all services with all integrations"
    echo "2) Reconfigure All - Update existing configuration for all services"
    echo "3) Configure Specific Service - Set up or reconfigure individual services"
    echo "4) Add Integration - Configure optional integrations (Discord, Twitch, etc.)"
    echo "5) Validate Configuration - Check current setup"
    echo "6) Exit"
    echo
    
    read -r -p "Select option [1-6]: " setup_mode
    echo
    
    case $setup_mode in
        1) full_setup ;;
        2) reconfigure_all ;;
        3) configure_specific_service ;;
        4) add_integration ;;
        5) validate_only ;;
        6) exit 0 ;;
        *) print_color "$RED" "Invalid option. Please try again."; show_main_menu ;;
    esac
}

# Function for full setup
full_setup() {
    print_header "Full Setup Mode"
    print_color "$YELLOW" "This will set up all services with full integration."
    echo
    
    check_prerequisites
    init_submodules
    setup_environment
    create_directories
    setup_streamsource
    setup_services
    start_services
    create_admin_account
    configure_discord_bot
    
    # Ask about optional integrations
    read -r -p "Configure Twitch integration? (y/N): " config_twitch
    if [[ "$config_twitch" =~ ^[Yy]$ ]]; then
        configure_twitch_integration
    fi
    
    show_final_instructions
}

# Function to reconfigure all services
reconfigure_all() {
    print_header "Reconfigure All Services"
    
    if [ ! -f "$ENV_FILE" ]; then
        print_color "$RED" "No existing configuration found. Running full setup instead."
        full_setup
        return
    fi
    
    print_color "$YELLOW" "This will update your existing configuration."
    read -r -p "Continue? (Y/n): " continue_reconfig
    if [[ "$continue_reconfig" =~ ^[Nn]$ ]]; then
        show_main_menu
        return
    fi
    
    # Backup existing config
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    print_color "$GREEN" "✓ Backed up existing configuration"
    
    setup_environment
    setup_streamsource
    setup_services
    
    # Restart services to apply changes
    print_color "$YELLOW" "Restarting services..."
    docker compose restart
    
    show_final_instructions
}

# Function to configure specific service
configure_specific_service() {
    print_header "Configure Specific Service"
    
    print_color "$BLUE" "Select service to configure:"
    echo "1) StreamSource (API Backend)"
    echo "2) Livestream Link Monitor (Discord/Twitch Bot)"
    echo "3) Livesheet Updater (Google Sheets Monitor)"
    echo "4) Streamwall (Desktop App)"
    echo "5) Back to main menu"
    echo
    
    read -r -p "Select service [1-5]: " service_choice
    echo
    
    case $service_choice in
        1) configure_streamsource_only ;;
        2) configure_livestream_monitor_only ;;
        3) configure_livesheet_checker_only ;;
        4) configure_streamwall_only ;;
        5) show_main_menu ;;
        *) print_color "$RED" "Invalid option."; configure_specific_service ;;
    esac
}

# Function to add integrations
add_integration() {
    print_header "Add Integration"
    
    print_color "$BLUE" "Select integration to configure:"
    echo "1) Discord Bot"
    echo "2) Twitch Chat Monitor"
    echo "3) Google Sheets (Legacy)"
    echo "4) Admin Account"
    echo "5) Back to main menu"
    echo
    
    read -r -p "Select integration [1-5]: " integration_choice
    echo
    
    case $integration_choice in
        1) configure_discord_bot; show_main_menu ;;
        2) configure_twitch_integration; show_main_menu ;;
        3) configure_google_sheets; show_main_menu ;;
        4) create_admin_account; show_main_menu ;;
        5) show_main_menu ;;
        *) print_color "$RED" "Invalid option."; add_integration ;;
    esac
}

# Function to validate configuration only
validate_only() {
    if [ -f "$SCRIPT_DIR/validate-config.sh" ]; then
        "$SCRIPT_DIR/validate-config.sh"
    else
        print_color "$RED" "Validation script not found!"
    fi
    echo
    read -r -p "Press Enter to return to main menu..."
    show_main_menu
}

# Individual service configuration functions
configure_streamsource_only() {
    print_header "Configure StreamSource"
    
    if [ ! -d "$SCRIPT_DIR/streamsource" ]; then
        print_color "$RED" "StreamSource not found. Please run 'git submodule update --init --recursive'"
        return
    fi
    
    setup_streamsource
    
    read -r -p "Start/restart StreamSource? (Y/n): " start_service
    if [[ ! "$start_service" =~ ^[Nn]$ ]]; then
        docker compose up -d streamsource
        print_color "$GREEN" "✓ StreamSource started"
    fi
    
    read -r -p "Create admin account? (Y/n): " create_admin
    if [[ ! "$create_admin" =~ ^[Nn]$ ]]; then
        # Wait for service to be ready
        sleep 5
        create_admin_account
    fi
    
    show_main_menu
}

configure_livestream_monitor_only() {
    print_header "Configure Livestream Link Monitor"
    
    if [ ! -d "$SCRIPT_DIR/livestream-link-monitor" ]; then
        print_color "$RED" "Livestream Link Monitor not found. Please run 'git submodule update --init --recursive'"
        return
    fi
    
    # Ensure we have API key
    if [ ! -f "$ENV_FILE" ]; then
        print_color "$YELLOW" "Main configuration not found. Setting up API key..."
        STREAMSOURCE_API_KEY=$(generate_secret)
        echo "STREAMSOURCE_API_KEY=$STREAMSOURCE_API_KEY" > "$ENV_FILE"
    fi
    
    cd "$SCRIPT_DIR/livestream-link-monitor"
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
    fi
    
    # Configure Discord
    configure_discord_bot
    
    # Ask about Twitch
    read -r -p "Configure Twitch integration? (y/N): " config_twitch
    if [[ "$config_twitch" =~ ^[Yy]$ ]]; then
        configure_twitch_integration
    fi
    
    cd "$SCRIPT_DIR"
    
    read -r -p "Start/restart Livestream Monitor? (Y/n): " start_service
    if [[ ! "$start_service" =~ ^[Nn]$ ]]; then
        docker compose up -d livestream-monitor
        print_color "$GREEN" "✓ Livestream Monitor started"
    fi
    
    show_main_menu
}

configure_livesheet_checker_only() {
    print_header "Configure Livesheet Updater"
    
    print_color "$YELLOW" "Note: Google Sheets integration is legacy. Consider using StreamSource API instead."
    echo
    
    configure_google_sheets
    
    read -r -p "Start/restart Livesheet Updater? (Y/n): " start_service
    if [[ ! "$start_service" =~ ^[Nn]$ ]]; then
        docker compose up -d livesheet-updater
        print_color "$GREEN" "✓ Livesheet Updater started"
    fi
    
    show_main_menu
}

configure_streamwall_only() {
    print_header "Configure Streamwall Desktop App"
    
    print_color "$YELLOW" "Streamwall can be run as:"
    echo "1) Electron desktop application (recommended)"
    echo "2) Docker container with web interface"
    echo
    
    read -r -p "Select option [1-2]: " streamwall_mode
    
    case $streamwall_mode in
        1)
            print_color "$BLUE" "To run Streamwall desktop app:"
            echo "cd streamwall"
            echo "npm install"
            echo "npm run start:app"
            ;;
        2)
            print_color "$BLUE" "Starting Streamwall in Docker..."
            docker compose --profile desktop up -d streamwall
            print_color "$GREEN" "✓ Streamwall web interface available at http://localhost:8080"
            ;;
    esac
    
    echo
    read -r -p "Press Enter to continue..."
    show_main_menu
}

# Additional integration functions
configure_twitch_integration() {
    print_header "Twitch Integration Setup"
    
    print_color "$YELLOW" "To monitor Twitch chat for stream links, you'll need:"
    echo "  1. Twitch channel name to monitor"
    echo "  2. (Optional) Twitch bot account for better rate limits"
    echo
    
    read -r -p "Enter Twitch channel to monitor (without #): " twitch_channel
    
    if [ -n "$twitch_channel" ]; then
        # Update configuration
        if [ -f "$ENV_FILE" ]; then
            if grep -q "TWITCH_CHANNEL=" "$ENV_FILE"; then
                sed_inplace "$ENV_FILE" "s|TWITCH_CHANNEL=.*|TWITCH_CHANNEL=$twitch_channel|"
            else
                echo "TWITCH_CHANNEL=$twitch_channel" >> "$ENV_FILE"
            fi
            
        fi
        
        # Also update service config if exists
        if [ -f "$SCRIPT_DIR/livestream-link-monitor/.env" ]; then
            sed_inplace "$SCRIPT_DIR/livestream-link-monitor/.env" "s|TWITCH_CHANNEL=.*|TWITCH_CHANNEL=$twitch_channel|"
        fi
        
        print_color "$GREEN" "✓ Twitch integration configured for channel: $twitch_channel"
        
        # Restart service if running
        if docker ps | grep -q livestream-monitor; then
            docker compose restart livestream-monitor
            print_color "$GREEN" "✓ Service restarted"
        fi
    fi
}

configure_google_sheets() {
    print_header "Google Sheets Configuration (Legacy)"
    
    print_color "$YELLOW" "Google Sheets requires:"
    echo "  1. A Google Cloud service account"
    echo "  2. The service account credentials JSON file"
    echo "  3. The Google Sheet ID"
    echo
    
    read -r -p "Enter Google Sheet ID: " sheet_id
    
    if [ -n "$sheet_id" ]; then
        # Update configuration
        if [ -f "$ENV_FILE" ]; then
            if grep -q "GOOGLE_SHEET_ID=" "$ENV_FILE"; then
                sed_inplace "$ENV_FILE" "s|GOOGLE_SHEET_ID=.*|GOOGLE_SHEET_ID=$sheet_id|"
            else
                echo "GOOGLE_SHEET_ID=$sheet_id" >> "$ENV_FILE"
            fi
            
        fi
        
        print_color "$YELLOW" "Please place your Google credentials JSON at:"
        print_color "$YELLOW" "  • livestream-link-monitor/creds.json"
        print_color "$YELLOW" "  • livesheet-updater/creds.json"
        echo
        
    read -r -p "Have you placed the credentials files? (y/N): " creds_placed
        if [[ "$creds_placed" =~ ^[Yy]$ ]]; then
            print_color "$GREEN" "✓ Google Sheets integration configured"
        else
            print_color "$YELLOW" "Remember to add credentials before starting services"
        fi
    fi
}

# Main setup flow
main() {
    print_color "$BLUE" "🚀 Streamwall Ecosystem Setup Wizard"
    print_color "$BLUE" "===================================="
    echo
    
    # Check if this is first run or reconfiguration
    if [ -f "$ENV_FILE" ] && [ -f "$SCRIPT_DIR/.setup-complete" ]; then
        show_main_menu
    else
        print_color "$YELLOW" "No previous setup detected. Running full setup..."
        echo
        full_setup
        touch "$SCRIPT_DIR/.setup-complete"
    fi
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full|--full-setup)
                full_setup
                exit 0
                ;;
            --reconfigure)
                reconfigure_all
                exit 0
                ;;
            --validate)
                if [ -f "$SCRIPT_DIR/validate-config.sh" ]; then
                    "$SCRIPT_DIR/validate-config.sh"
                else
                    print_color "$RED" "Validation script not found!"
                    exit 1
                fi
                exit 0
                ;;
            --service)
                shift
                case $1 in
                    streamsource) configure_streamsource_only; exit 0 ;;
                    livestream-monitor) configure_livestream_monitor_only; exit 0 ;;
                    livesheet-updater) configure_livesheet_checker_only; exit 0 ;;
                    streamwall) configure_streamwall_only; exit 0 ;;
                    *) print_color "$RED" "Unknown service: $1"; exit 1 ;;
                esac
                ;;
            --integration)
                shift
                case $1 in
                    discord) configure_discord_bot; exit 0 ;;
                    twitch) configure_twitch_integration; exit 0 ;;
                    google-sheets) configure_google_sheets; exit 0 ;;
                    admin) create_admin_account; exit 0 ;;
                    *) print_color "$RED" "Unknown integration: $1"; exit 1 ;;
                esac
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_color "$RED" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done
}

# Show help message
show_help() {
    print_color "$BLUE" "Streamwall Setup Wizard"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --full, --full-setup     Run full setup for all services"
    echo "  --reconfigure           Reconfigure all existing services"
    echo "  --validate              Validate current configuration"
    echo "  --service SERVICE       Configure specific service:"
    echo "                          streamsource, livestream-monitor,"
    echo "                          livesheet-updater, streamwall"
    echo "  --integration TYPE      Configure specific integration:"
    echo "                          discord, twitch, google-sheets, admin"
    echo "  --help, -h              Show this help message"
    echo
    echo "Examples:"
    echo "  $0                      # Interactive mode"
    echo "  $0 --full               # Full setup"
    echo "  $0 --service streamsource"
    echo "  $0 --integration discord"
    echo "  $0 --validate"
}

# Check if arguments were provided
if [[ $# -gt 0 ]]; then
    parse_args "$@"
else
    # No arguments, run main interactive flow
    main
fi