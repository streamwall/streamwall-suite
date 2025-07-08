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
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
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

# Check ports
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

ports_ok=true
for port in 3000 3001 5432 6379 8080; do
    if ! check_port $port; then
        ports_ok=false
    fi
done

if [ "$ports_ok" = false ]; then
    echo -e "${YELLOW}💡 Some ports are in use. The services will use alternative ports.${NC}"
    # Auto-adjust ports in .env
    export STREAMSOURCE_PORT=3010
    export LIVESTREAM_MONITOR_PORT=3011
    export POSTGRES_PORT=5433
    export REDIS_PORT=6380
    export STREAMWALL_WEB_PORT=8081
fi

echo -e "${GREEN}✅ Pre-flight checks passed!${NC}\n"

# Setup mode selection
echo -e "${CYAN}🚀 Choose your setup mode:${NC}"
echo "  1) ${BOLD}Demo Mode${NC} - Pre-configured with sample data (recommended for first-time users)"
echo "  2) ${BOLD}Development Mode${NC} - Real services with easy defaults"
echo "  3) ${BOLD}Custom Mode${NC} - Configure everything yourself"
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
        cat > .env.demo << 'EOF'
# Demo Mode Configuration
NODE_ENV=development
RAILS_ENV=development
TZ=UTC

# Demo Mode Flag
DEMO_MODE=true

# Service Ports
STREAMSOURCE_PORT=3000
LIVESTREAM_MONITOR_PORT=3001
POSTGRES_PORT=5432
REDIS_PORT=6379
STREAMWALL_WEB_PORT=8080

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

# Demo Admin Account
ADMIN_EMAIL=admin@streamwall.local
ADMIN_PASSWORD=streamwall123

# Backend Configuration
BACKEND_TYPE=streamsource
EOF
        
        # Use demo env
        cp .env.demo .env
        
        # Start with demo profile
        COMPOSE_PROFILES="demo" docker compose up -d
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
        
        # Start normal services
        docker compose up -d
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
    echo -ne "${YELLOW}⏳ Starting $name...${NC}"
    
    # Start checking in background
    (
        if [ "$service" = "streamsource" ]; then
            check_service $service "http://localhost:3000/health"
        else
            sleep 3  # Give other services time to start
        fi
    ) &
    pid=$!
    spinner $pid
    
    wait $pid
    if [ $? -eq 0 ]; then
        echo -e "\r${GREEN}✅ $name started successfully${NC}"
    else
        echo -e "\r${RED}❌ $name failed to start${NC}"
    fi
done

# If demo mode, load sample data
if [ "$mode" = "1" ]; then
    echo -e "\n${CYAN}📊 Loading demo data...${NC}"
    
    # Wait a bit more for API to be fully ready
    sleep 5
    
    # Create demo admin user
    docker compose exec -T streamsource rails runner "
        User.create!(
            email: 'admin@streamwall.local',
            password: 'streamwall123',
            role: 'admin'
        ) rescue nil
    " 2>/dev/null || true
    
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
echo -e "   StreamSource API: ${BOLD}http://localhost:3000${NC}"
echo -e "   API Health Check: ${BOLD}http://localhost:3000/health${NC}"

if [ "$mode" = "1" ]; then
    echo -e "\n${CYAN}🔑 Demo Credentials:${NC}"
    echo -e "   Email: ${BOLD}admin@streamwall.local${NC}"
    echo -e "   Password: ${BOLD}streamwall123${NC}"
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
if command -v open &> /dev/null; then
    read -p "Open StreamSource in browser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open http://localhost:3000
    fi
elif command -v xdg-open &> /dev/null; then
    read -p "Open StreamSource in browser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open http://localhost:3000
    fi
fi