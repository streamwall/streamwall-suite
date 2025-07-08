#!/usr/bin/env bash
# Pre-flight checks with auto-recovery for common issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Running pre-flight checks...${NC}\n"

# Track if we fixed anything
FIXES_APPLIED=false

# Check Docker
check_docker() {
    echo -n "Docker installation... "
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Not found${NC}"
        echo -e "${YELLOW}Please install Docker: https://docs.docker.com/get-docker/${NC}"
        return 1
    fi
    echo -e "${GREEN}✅${NC}"
    
    echo -n "Docker daemon... "
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Not running${NC}"
        
        # Try to start Docker daemon
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "${YELLOW}Attempting to start Docker Desktop...${NC}"
            open -a Docker 2>/dev/null || {
                echo -e "${RED}Could not start Docker Desktop. Please start it manually.${NC}"
                return 1
            }
            
            # Wait for Docker to start
            echo -n "Waiting for Docker to start"
            for i in {1..30}; do
                if docker info &> /dev/null; then
                    echo -e " ${GREEN}✅${NC}"
                    FIXES_APPLIED=true
                    return 0
                fi
                echo -n "."
                sleep 1
            done
            echo -e " ${RED}timeout${NC}"
            return 1
        else
            echo -e "${YELLOW}Please start the Docker daemon:${NC}"
            echo "  sudo systemctl start docker  # Linux"
            echo "  open -a Docker              # macOS"
            return 1
        fi
    fi
    echo -e "${GREEN}✅${NC}"
}

# Check ports
check_ports() {
    local ports=(3000 3001 5432 6379 8080)
    local port_names=("StreamSource API" "Monitor Service" "PostgreSQL" "Redis" "Streamwall Web")
    local conflicts=()
    
    echo "Port availability:"
    
    for i in "${!ports[@]}"; do
        port="${ports[$i]}"
        name="${port_names[$i]}"
        
        echo -n "  Port $port ($name)... "
        
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  In use${NC}"
            
            # Find what's using the port
            local process=$(lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | tail -n 1 | awk '{print $1}')
            echo -e "    Used by: ${YELLOW}$process${NC}"
            
            conflicts+=($port)
        else
            echo -e "${GREEN}✅ Available${NC}"
        fi
    done
    
    # If conflicts found, offer to fix
    if [ ${#conflicts[@]} -gt 0 ]; then
        echo -e "\n${YELLOW}Port conflicts detected!${NC}"
        echo "Options:"
        echo "  1) Kill conflicting processes (requires confirmation)"
        echo "  2) Use alternative ports"
        echo "  3) Skip and handle manually"
        
        read -p "Choose option (1-3) [2]: " choice
        choice=${choice:-2}
        
        case $choice in
            1)
                for port in "${conflicts[@]}"; do
                    local pid=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null)
                    if [ ! -z "$pid" ]; then
                        local process=$(ps -p $pid -o comm= 2>/dev/null)
                        read -p "Kill $process (PID: $pid) on port $port? (y/N) " -n 1 -r
                        echo
                        if [[ $REPLY =~ ^[Yy]$ ]]; then
                            kill $pid 2>/dev/null && echo -e "${GREEN}✅ Killed process on port $port${NC}" || echo -e "${RED}Failed to kill process${NC}"
                            FIXES_APPLIED=true
                        fi
                    fi
                done
                ;;
            2)
                echo -e "${YELLOW}Using alternative ports...${NC}"
                
                # Create port mapping
                cat > .env.ports << EOF
# Alternative ports to avoid conflicts
STREAMSOURCE_PORT=3010
LIVESTREAM_MONITOR_PORT=3011
POSTGRES_PORT=5433
REDIS_PORT=6380
STREAMWALL_WEB_PORT=8081
EOF
                
                echo -e "${GREEN}✅ Created .env.ports with alternative ports${NC}"
                FIXES_APPLIED=true
                ;;
            3)
                echo -e "${YELLOW}Skipping port conflict resolution${NC}"
                ;;
        esac
    fi
}

# Check disk space
check_disk_space() {
    echo -n "Disk space... "
    
    local available=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    
    if [ "$available" -lt 2 ]; then
        echo -e "${RED}❌ Low space (${available}GB available)${NC}"
        echo -e "${YELLOW}At least 2GB recommended. Clean up with:${NC}"
        echo "  docker system prune -a"
        return 1
    else
        echo -e "${GREEN}✅ ${available}GB available${NC}"
    fi
}

# Check file permissions
check_permissions() {
    echo "File permissions:"
    
    # Check if we can write to current directory
    echo -n "  Current directory... "
    if [ -w . ]; then
        echo -e "${GREEN}✅ Writable${NC}"
    else
        echo -e "${RED}❌ Not writable${NC}"
        echo -e "${YELLOW}Fix with: sudo chown -R $(whoami) .${NC}"
        return 1
    fi
    
    # Fix permissions on sensitive files if they exist
    for file in .env credentials.json .env.local; do
        if [ -f "$file" ]; then
            echo -n "  $file permissions... "
            current_perms=$(stat -c %a "$file" 2>/dev/null || stat -f %p "$file" 2>/dev/null | tail -c 4)
            
            if [ "$current_perms" != "600" ]; then
                echo -e "${YELLOW}⚠️  Too permissive (${current_perms})${NC}"
                chmod 600 "$file"
                echo -e "    ${GREEN}✅ Fixed (now 600)${NC}"
                FIXES_APPLIED=true
            else
                echo -e "${GREEN}✅ Secure (600)${NC}"
            fi
        fi
    done
}

# Check environment setup
check_environment() {
    echo "Environment setup:"
    
    # Check for .env file
    echo -n "  .env file... "
    if [ ! -f .env ]; then
        echo -e "${YELLOW}⚠️  Missing${NC}"
        
        if [ -f .env.development ]; then
            echo -e "    ${YELLOW}Creating from .env.development...${NC}"
            cp .env.development .env
            FIXES_APPLIED=true
            echo -e "    ${GREEN}✅ Created${NC}"
        elif [ -f .env.example ]; then
            echo -e "    ${YELLOW}Creating from .env.example...${NC}"
            cp .env.example .env
            FIXES_APPLIED=true
            echo -e "    ${GREEN}✅ Created${NC}"
        fi
    else
        echo -e "${GREEN}✅ Exists${NC}"
    fi
    
    # Check for required keys
    if [ -f .env ]; then
        echo -n "  Security keys... "
        
        if grep -q "WILL_BE_GENERATED_ON_FIRST_RUN\|development_secret_key_base_change_in_production" .env; then
            echo -e "${YELLOW}⚠️  Using placeholder values${NC}"
            echo -e "    ${YELLOW}Generating secure keys...${NC}"
            
            # Generate secure keys
            SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "dev_secret_$(date +%s)")
            JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "dev_jwt_$(date +%s)")
            API_KEY=$(openssl rand -hex 32 2>/dev/null || echo "dev_api_$(date +%s)")
            
            # Update .env
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/SECRET_KEY_BASE=.*/SECRET_KEY_BASE=$SECRET_KEY/" .env
                sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
                sed -i '' "s/STREAMSOURCE_API_KEY=.*/STREAMSOURCE_API_KEY=$API_KEY/" .env
            else
                sed -i "s/SECRET_KEY_BASE=.*/SECRET_KEY_BASE=$SECRET_KEY/" .env
                sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
                sed -i "s/STREAMSOURCE_API_KEY=.*/STREAMSOURCE_API_KEY=$API_KEY/" .env
            fi
            
            FIXES_APPLIED=true
            echo -e "    ${GREEN}✅ Generated secure keys${NC}"
        else
            echo -e "${GREEN}✅ Configured${NC}"
        fi
    fi
}

# Check Docker resources
check_docker_resources() {
    echo -n "Docker resources... "
    
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        # Check if we have enough resources allocated to Docker
        local mem_limit=$(docker info --format '{{.MemTotal}}' 2>/dev/null)
        
        if [ ! -z "$mem_limit" ]; then
            local mem_gb=$((mem_limit / 1073741824))
            
            if [ "$mem_gb" -lt 4 ]; then
                echo -e "${YELLOW}⚠️  Low memory (${mem_gb}GB)${NC}"
                echo -e "    ${YELLOW}Recommend allocating at least 4GB to Docker${NC}"
            else
                echo -e "${GREEN}✅ ${mem_gb}GB allocated${NC}"
            fi
        else
            echo -e "${GREEN}✅${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Cannot check${NC}"
    fi
}

# Main checks
echo -e "${BLUE}System Checks:${NC}"
check_docker || true
check_disk_space || true
echo

echo -e "${BLUE}Network Checks:${NC}"
check_ports || true
echo

echo -e "${BLUE}Security Checks:${NC}"
check_permissions || true
check_environment || true
echo

echo -e "${BLUE}Resource Checks:${NC}"
check_docker_resources || true
echo

# Summary
if [ "$FIXES_APPLIED" = true ]; then
    echo -e "${GREEN}✅ Pre-flight checks complete with auto-fixes applied!${NC}"
    echo -e "${YELLOW}Please review the changes above.${NC}"
else
    echo -e "${GREEN}✅ All pre-flight checks passed!${NC}"
fi

# Check if we should load alternative ports
if [ -f .env.ports ]; then
    echo -e "\n${YELLOW}📝 Note: Alternative ports configured in .env.ports${NC}"
    echo "To use them, run:"
    echo "  source .env.ports && docker compose up -d"
fi

exit 0