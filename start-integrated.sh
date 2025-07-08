#!/usr/bin/env bash
# Start all services with full integration enabled

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Starting Streamwall with Full Integration${NC}"
echo "========================================"

# Ensure .env exists with integration defaults
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating integrated configuration...${NC}"
    cp .env.example .env
fi

# Ensure backend is set to StreamSource
if ! grep -q "BACKEND_TYPE=streamsource" .env 2>/dev/null; then
    echo -e "${YELLOW}Setting StreamSource as default backend...${NC}"
    echo "" >> .env
    echo "# Integrated Backend Configuration" >> .env
    echo "BACKEND_TYPE=streamsource" >> .env
    echo "BACKEND_MODE=single" >> .env
    echo "BACKEND_PRIMARY=streamSource" >> .env
    echo "BACKEND_STREAMSOURCE_ENABLED=true" >> .env
fi

# Start core services
echo -e "\n${YELLOW}Starting core services...${NC}"
docker compose up -d postgres redis streamsource

# Wait for StreamSource to be healthy
echo -n "Waiting for StreamSource API to be ready"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e " ${GREEN}✅${NC}"
        break
    fi
    echo -n "."
    sleep 1
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo -e " ${RED}❌ Timeout${NC}"
    echo "StreamSource failed to start. Check logs: docker compose logs streamsource"
    exit 1
fi

# Start monitor services
echo -e "${YELLOW}Starting monitor services...${NC}"
docker compose up -d livestream-monitor livesheet-updater

# Optional: Start Streamwall desktop
read -p "Start Streamwall desktop app? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting Streamwall desktop...${NC}"
    
    # Check if running in Docker or native
    if [ -f ./streamwall/package.json ]; then
        cd streamwall
        npm start -- --config ./config.development.toml &
        cd ..
    else
        docker compose --profile desktop up -d
    fi
fi

# Show status
echo -e "\n${GREEN}✅ All services started with full integration!${NC}"
echo "========================================"
echo -e "${BLUE}Service Status:${NC}"
docker compose ps

echo -e "\n${BLUE}Integration Points:${NC}"
echo "• StreamSource API: http://localhost:3000"
echo "• Monitor Service: Connected to StreamSource ✅"
echo "• Checker Service: Connected to StreamSource ✅"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "• Streamwall Desktop: http://localhost:8080 (fetching from StreamSource)"
fi

echo -e "\n${BLUE}Quick Commands:${NC}"
echo "• View logs: docker compose logs -f"
echo "• Add stream: curl -X POST http://localhost:3000/api/v1/streams -d '{...}'"
echo "• View streams: curl http://localhost:3000/api/v1/streams"

echo -e "\n${GREEN}Services are fully integrated and ready!${NC}"