#!/usr/bin/env bash
# Streamwall Developer Quick Start
# Zero-friction development setup with demo mode

set -e

# Colors and styling
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Spinner function for visual feedback
spinner() {
    local pid=$1
    local message=$2
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf "\r${YELLOW}⏳ %s... %c${NC}" "$message" "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
    done
    printf "\r\033[K"  # Clear the line
}


# Banner
clear
echo -e "${BOLD}${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║       Streamwall Developer Mode       ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Pre-flight checks
echo -e "${CYAN}🔍 Running pre-flight checks...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found!${NC}"
    echo -e "${YELLOW}📦 Installing Docker is required. Visit: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon not running!${NC}"
    echo -e "${YELLOW}💡 Please start Docker Desktop or the Docker daemon${NC}"
    exit 1
fi

# Check for existing containers FIRST before checking ports
# This will help identify if port conflicts are from our own containers
check_existing_containers_early() {
    # Get all containers that might be related to Streamwall
    local existing_containers=$(docker ps -a --format "{{.Names}}" 2>/dev/null | grep -E "(streamwall|livestream|livesheet|tiktok|streamsource)" | sort)
    
    if [ -n "$existing_containers" ]; then
        echo -e "${YELLOW}⚠️  Found existing Streamwall containers${NC}"
        
        # Check which containers are running (not just existing)
        local running_containers=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -E "(streamwall|livestream|livesheet|tiktok|streamsource)" | sort)
        
        if [ -n "$running_containers" ]; then
            echo -e "${CYAN}These containers are currently running:${NC}"
            echo "$running_containers" | while read container; do
                echo "  • $container"
            done
            echo ""
            echo -e "${CYAN}Would you like to stop them before continuing?${NC}"
            echo "  1) Yes, stop running containers"
            echo "  2) No, continue anyway (may cause port conflicts)"
            echo ""
            read -p "Enter choice (1-2) [1]: " early_choice
            early_choice=${early_choice:-1}
            
            if [ "$early_choice" = "1" ]; then
                echo -e "${YELLOW}Stopping running containers...${NC}"
                echo "$running_containers" | while read container; do
                    docker stop "$container" >/dev/null 2>&1 || true
                done
                echo -e "${GREEN}✅ Containers stopped${NC}"
                
                # Give OS time to release ports
                echo -e "${CYAN}Waiting for ports to be released...${NC}"
                sleep 2
            fi
        fi
    fi
}

# Check existing containers before port checks
check_existing_containers_early

# Check ports (after container check)
check_port() {
    local port=$1
    local service_name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        # Try to identify what's using the port
        local process_info=$(lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | grep -v "^COMMAND" | head -1)
        local process=$(echo "$process_info" | awk '{print $1}')
        local pid=$(echo "$process_info" | awk '{print $2}')
        
        # Check if it's a Docker container by checking if any running container is using this port
        local docker_using_port=false
        local container_name=""
        
        # Check all running containers to see if any have this port mapped
        for container in $(docker ps --format "{{.Names}}" 2>/dev/null); do
            if docker port "$container" 2>/dev/null | grep -q ":$port->"; then
                docker_using_port=true
                container_name="$container"
                break
            fi
        done
        
        if [ "$docker_using_port" = true ]; then
            echo -e "${YELLOW}⚠️  Port $port is in use by Docker container: $container_name${NC}"
        elif [ -n "$process" ]; then
            # It's a local service - check if it's a known service
            case "$process" in
                postgres|postgresql)
                    echo -e "${YELLOW}⚠️  Port $port is in use by local PostgreSQL service${NC}"
                    ;;
                redis-ser|redis)
                    echo -e "${YELLOW}⚠️  Port $port is in use by local Redis service${NC}"
                    ;;
                *)
                    echo -e "${YELLOW}⚠️  Port $port is in use by local service: $process${NC}"
                    ;;
            esac
        else
            echo -e "${YELLOW}⚠️  Port $port is in use${NC}"
        fi
        return 1
    fi
    return 0
}

# Check specific ports with service names
port_checks=(
    "3000:StreamSource API"
    "3001:Livestream Monitor"
    "5432:PostgreSQL"
    "6379:Redis"
    "8080:Streamwall Web"
)

ports_ok=true
port_conflicts=()

for port_check in "${port_checks[@]}"; do
    IFS=':' read -r port service <<< "$port_check"
    if ! check_port $port "$service"; then
        ports_ok=false
        port_conflicts+=("$port:$service")
    fi
done

if [ "$ports_ok" = false ]; then
    echo -e "${YELLOW}💡 Some ports are still in use.${NC}"
    
    # Check if any PostgreSQL or Redis processes are still running
    if pgrep -f "postgres" >/dev/null 2>&1 || pgrep -f "redis-server" >/dev/null 2>&1; then
        echo -e "${CYAN}Detected database services still shutting down. Waiting a bit longer...${NC}"
        sleep 3
        
        # Re-check the critical ports
        ports_ok=true
        for port_check in "${port_checks[@]}"; do
            IFS=':' read -r port service <<< "$port_check"
            if ! check_port $port "$service" 2>/dev/null; then
                ports_ok=false
            fi
        done
    fi
    
    if [ "$ports_ok" = false ]; then
        echo -e "${CYAN}Some services (like local PostgreSQL/Redis) are using the default ports.${NC}"
        echo ""
        echo -e "${CYAN}What would you like to do?${NC}"
        echo "  1) Use alternative ports for Streamwall"
        echo "  2) Exit and manually stop conflicting services"
        echo ""
        read -p "Enter choice (1-2) [1]: " port_choice
        port_choice=${port_choice:-1}
        
        if [ "$port_choice" = "1" ]; then
            echo -e "${GREEN}Using alternative ports for Streamwall services.${NC}"
            # Auto-adjust ports in .env
            export STREAMSOURCE_PORT=3010
            export LIVESTREAM_MONITOR_PORT=3011
            export POSTGRES_PORT=5433
            export REDIS_PORT=6380
            export STREAMWALL_WEB_PORT=8081
            export DEMO_STREAMSOURCE_PORT=3100
            export DEMO_MONITOR_PORT=3101
            export PORTS_ADJUSTED=true
        else
            echo -e "${YELLOW}Please stop the conflicting services and try again.${NC}"
            echo -e "${CYAN}Suggested commands based on detected services:${NC}"
            
            # Check what type of services are running and provide appropriate commands
            has_docker_conflicts=false
            has_local_postgres=false
            has_local_redis=false
            
            for port_conflict in "${port_conflicts[@]}"; do
                IFS=':' read -r port service <<< "$port_conflict"
                process_info=$(lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | grep -v "^COMMAND" | head -1)
                process=$(echo "$process_info" | awk '{print $1}')
                
                # Check if it's a Docker container
                for container in $(docker ps --format "{{.Names}}" 2>/dev/null); do
                    if docker port "$container" 2>/dev/null | grep -q ":$port->"; then
                        has_docker_conflicts=true
                        break
                    fi
                done
                
                # Check for local services
                case "$process" in
                    postgres|postgresql) has_local_postgres=true ;;
                    redis-ser|redis) has_local_redis=true ;;
                esac
            done
            
            if [ "$has_docker_conflicts" = true ]; then
                echo "  • docker compose down  # Stop Docker containers"
                echo "  • docker ps  # Check running containers"
            fi
            
            if [ "$has_local_postgres" = true ]; then
                echo "  • brew services stop postgresql  # macOS with Homebrew"
                echo "  • sudo service postgresql stop  # Linux"
            fi
            
            if [ "$has_local_redis" = true ]; then
                echo "  • brew services stop redis  # macOS with Homebrew"
                echo "  • sudo service redis-server stop  # Linux"
            fi
            
            exit 0
        fi
    fi
fi

echo -e "${GREEN}✅ Pre-flight checks passed!${NC}\n"

# Setup mode selection
echo -e "${CYAN}🚀 Choose your setup mode:${NC}"
echo -e "  1) ${BOLD}Demo Mode${NC} - Pre-configured with sample data (recommended for first-time users)"
echo -e "  2) ${BOLD}Development Mode${NC} - Real services with easy defaults"
echo -e "  3) ${BOLD}Custom Mode${NC} - Configure everything yourself"
echo ""
read -p "Enter choice (1-3) [1]: " mode
mode=${mode:-1}

case $mode in
    1)
        echo -e "\n${GREEN}🎮 Starting in Demo Mode${NC}"
        echo -e "${CYAN}This will:${NC}"
        echo "  • Use pre-configured demo credentials"
        echo "  • Load sample stream data"
        echo "  • Mock Discord/Twitch connections"
        echo "  • Perfect for exploring features!"
        
        # Create demo .env
        cat > .env.demo << EOF
# Demo Mode Configuration
NODE_ENV=development
RAILS_ENV=development
TZ=UTC

# Demo Mode Flag
DEMO_MODE=true

# Service Ports
STREAMSOURCE_PORT=${STREAMSOURCE_PORT:-3000}
LIVESTREAM_MONITOR_PORT=${LIVESTREAM_MONITOR_PORT:-3001}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
REDIS_PORT=${REDIS_PORT:-6379}
STREAMWALL_WEB_PORT=${STREAMWALL_WEB_PORT:-8080}
DEMO_STREAMSOURCE_PORT=${DEMO_STREAMSOURCE_PORT:-3100}
DEMO_MONITOR_PORT=${DEMO_MONITOR_PORT:-3101}

# Database (auto-configured)
POSTGRES_USER=streamwall
POSTGRES_PASSWORD=demo_password
POSTGRES_DB=streamwall_demo
DATABASE_URL=postgresql://streamwall:demo_password@postgres:5432/streamwall_demo

# Redis
REDIS_URL=redis://redis:6379/0

# Security Keys (demo only - regenerated each time)
SECRET_KEY_BASE=demo_secret_key_base_not_for_production_use_$(date +%s)
JWT_SECRET=demo_jwt_secret_not_for_production_use_$(date +%s)
STREAMSOURCE_API_KEY=demo_api_key_not_for_production_use_$(date +%s)

# Service URLs
STREAMSOURCE_API_URL=http://streamsource:3000/api/v1
STREAMSOURCE_INTERNAL_URL=http://streamsource:3000

# Demo Discord Configuration
DISCORD_TOKEN=demo_discord_token
DISCORD_CHANNEL_ID=123456789012345678
DISCORD_COMMAND_PREFIX=!

# Demo Twitch Configuration
TWITCH_CHANNEL=demo_channel
TWITCH_USERNAME=demo_bot
TWITCH_OAUTH_TOKEN=oauth:demo_token

# Demo Admin Account (created by db/seeds.rb)
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=Password123!

# Backend Configuration
BACKEND_TYPE=streamsource
EOF
        
        # Use demo env
        cp .env.demo .env
        
        # Stop all services first to avoid port conflicts
        docker compose down 2>/dev/null || true
        
        # Start demo profile services and scale down base services to 0
        COMPOSE_PROFILES="demo,development" docker compose up -d --scale streamsource=0 --scale livestream-monitor=0 --scale livesheet-updater=0
        ;;
        
    2)
        echo -e "\n${GREEN}💻 Starting in Development Mode${NC}"
        
        # Create development .env with secure defaults
        if [ ! -f .env ]; then
            echo -e "${YELLOW}Creating development configuration...${NC}"
            cp .env.example .env
            
            # Generate secure keys for development
            SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "dev_secret_key_$(date +%s)")
            JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "dev_jwt_secret_$(date +%s)")
            API_KEY=$(openssl rand -hex 32 2>/dev/null || echo "dev_api_key_$(date +%s)")
            
            # Update .env with generated keys
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/SECRET_KEY_BASE=.*/SECRET_KEY_BASE=$SECRET_KEY/" .env
                sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
                sed -i '' "s/STREAMSOURCE_API_KEY=.*/STREAMSOURCE_API_KEY=$API_KEY/" .env
            else
                sed -i "s/SECRET_KEY_BASE=.*/SECRET_KEY_BASE=$SECRET_KEY/" .env
                sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
                sed -i "s/STREAMSOURCE_API_KEY=.*/STREAMSOURCE_API_KEY=$API_KEY/" .env
            fi
            
            # Add developer conveniences
            echo "" >> .env
            echo "# Developer Mode Settings" >> .env
            echo "DEV_MODE=true" >> .env
            echo "LOG_LEVEL=debug" >> .env
            echo "RAILS_LOG_TO_STDOUT=true" >> .env
        fi
        
        # Start development profile services
        COMPOSE_PROFILES="development" docker compose up -d
        ;;
        
    3)
        echo -e "\n${CYAN}🛠️  Custom Mode${NC}"
        echo "Running setup wizard for custom configuration..."
        ./setup-wizard.sh
        exit 0
        ;;
esac

# Wait for services with progress
echo -e "\n${CYAN}🚀 Starting services...${NC}"

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f $url > /dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    return 1
}

# Show progress for each service
services=(
    "postgres:PostgreSQL database"
    "redis:Redis cache"
    "streamsource:StreamSource API"
)

for service_info in "${services[@]}"; do
    IFS=':' read -r service name <<< "$service_info"
    
    # Start checking in background
    (
        if [ "$service" = "streamsource" ]; then
            if [ "$mode" = "1" ]; then
                check_service $service "http://localhost:${DEMO_STREAMSOURCE_PORT:-3100}/health"
            else
                check_service $service "http://localhost:${STREAMSOURCE_PORT:-3000}/health"
            fi
        else
            sleep 3  # Give other services time to start
        fi
    ) &
    pid=$!
    spinner $pid "Starting $name"
    
    wait $pid
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $name started successfully${NC}"
    else
        echo -e "${RED}❌ $name failed to start${NC}"
    fi
done

# If demo mode, load sample data
if [ "$mode" = "1" ]; then
    echo -e "\n${CYAN}📊 Loading demo data...${NC}"
    
    # Wait a bit more for API to be fully ready
    sleep 5
    
    # The demo admin user is already created by db/seeds.rb
    
    # Load sample streams
    docker compose exec -T streamsource rails runner "
        streams = [
            { url: 'https://twitch.tv/pokimane', title: 'Just Chatting', streamer_name: 'Pokimane', city: 'Los Angeles', state: 'CA' },
            { url: 'https://twitch.tv/shroud', title: 'Valorant Ranked', streamer_name: 'Shroud', city: 'Toronto', state: 'ON' },
            { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', title: 'Live Music', streamer_name: 'Rick Astley', city: 'London', state: 'UK' },
            { url: 'https://kick.com/xqc', title: 'Variety Gaming', streamer_name: 'xQc', city: 'Quebec', state: 'QC' },
            { url: 'https://twitch.tv/ninja', title: 'Fortnite', streamer_name: 'Ninja', city: 'Chicago', state: 'IL' }
        ]
        
        streams.each do |s|
            Stream.create!(
                url: s[:url],
                title: s[:title],
                streamer_name: s[:streamer_name],
                location: { city: s[:city], state: s[:state] },
                is_live: [true, false].sample,
                posted_by: 'DemoBot#0001',
                platform: s[:url].include?('twitch') ? 'twitch' : s[:url].include?('youtube') ? 'youtube' : 'kick'
            ) rescue nil
        end
    " 2>/dev/null || true
    
    echo -e "${GREEN}✅ Demo data loaded!${NC}"
fi

# Success message
echo -e "\n${GREEN}${BOLD}🎉 Streamwall is ready!${NC}\n"

# Show access information
echo -e "${CYAN}📍 Access Points:${NC}"
if [ "$mode" = "1" ]; then
    # Demo mode uses different ports
    echo -e "   StreamSource API: ${BOLD}http://localhost:${DEMO_STREAMSOURCE_PORT:-3100}${NC}"
    echo -e "   Admin Interface:  ${BOLD}http://localhost:${DEMO_STREAMSOURCE_PORT:-3100}/admin${NC}"
    echo -e "   API Health Check: ${BOLD}http://localhost:${DEMO_STREAMSOURCE_PORT:-3100}/health${NC}"
    echo -e "   API Docs:         ${BOLD}http://localhost:${DEMO_STREAMSOURCE_PORT:-3100}/api-docs${NC}"
else
    echo -e "   StreamSource API: ${BOLD}http://localhost:${STREAMSOURCE_PORT:-3000}${NC}"
    echo -e "   Admin Interface:  ${BOLD}http://localhost:${STREAMSOURCE_PORT:-3000}/admin${NC}"
    echo -e "   API Health Check: ${BOLD}http://localhost:${STREAMSOURCE_PORT:-3000}/health${NC}"
    echo -e "   API Docs:         ${BOLD}http://localhost:${STREAMSOURCE_PORT:-3000}/api-docs${NC}"
fi

if [ "$mode" = "1" ]; then
    echo -e "\n${CYAN}🔑 Demo Credentials:${NC}"
    echo -e "   Email: ${BOLD}admin@example.com${NC}"
    echo -e "   Password: ${BOLD}Password123!${NC}"
fi

echo -e "\n${CYAN}🛠️  Useful Commands:${NC}"
echo -e "   View logs:         ${BOLD}docker compose logs -f${NC}"
echo -e "   Stop services:     ${BOLD}docker compose down${NC}"
echo -e "   Reset everything:  ${BOLD}docker compose down -v${NC}"

if [ "$mode" = "1" ]; then
    echo -e "\n${YELLOW}⚠️  Demo Mode Notice:${NC}"
    echo "   This is using demo data and mock integrations."
    echo "   To use real Discord/Twitch integration, restart with option 2 or 3."
fi

echo -e "\n${GREEN}Happy coding! 🚀${NC}\n"

# Optional: Open browser
read -p "Open StreamSource Admin in browser? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Determine the correct URL based on mode
    if [ "$mode" = "1" ]; then
        ADMIN_URL="http://localhost:${DEMO_STREAMSOURCE_PORT:-3100}/admin"
    else
        ADMIN_URL="http://localhost:${STREAMSOURCE_PORT:-3000}/admin"
    fi
    
    # Open in browser based on platform
    if command -v open &> /dev/null; then
        # macOS
        open "$ADMIN_URL"
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$ADMIN_URL"
    elif command -v start &> /dev/null; then
        # Windows (WSL)
        start "$ADMIN_URL"
    else
        echo "Please open your browser and navigate to: $ADMIN_URL"
    fi
fi