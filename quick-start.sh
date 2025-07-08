#!/usr/bin/env bash
# Streamwall Quick Start Script
# One-command setup and start

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Streamwall Quick Start${NC}"
echo "===================="

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file with defaults...${NC}"
    cp .env.example .env
    
    # Generate secure keys
    echo -e "${YELLOW}Generating secure keys...${NC}"
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
fi

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker compose up -d

# Wait for services
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Show status
echo -e "\n${GREEN}✓ Services started!${NC}"
docker compose ps

echo -e "\n${GREEN}Quick Start Complete!${NC}"
echo "===================="
echo "StreamSource API: http://localhost:3000"
echo "View logs: docker compose logs -f"
echo ""
echo "To configure Discord/Twitch integration, run: ./setup-wizard.sh"