#!/bin/bash

# Streamwall Ecosystem Setup Script
# This script helps set up the complete Streamwall ecosystem

set -e

echo "🚀 Streamwall Ecosystem Setup"
echo "============================"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker."
    exit 1
fi

echo "✅ Docker is running"

# Initialize git submodules
echo ""
echo "Initializing git submodules..."
if git submodule update --init --recursive; then
    echo "✅ Git submodules initialized"
else
    echo "⚠️  Failed to initialize git submodules"
    echo "   You may need to configure your git credentials"
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Generate secure keys if not present
    SECRET_KEY_BASE=$(openssl rand -hex 64)
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Add generated keys to .env
    echo "" >> .env
    echo "# Auto-generated secure keys" >> .env
    echo "SECRET_KEY_BASE=$SECRET_KEY_BASE" >> .env
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    
    echo "✅ .env file created with secure defaults"
else
    echo "✅ .env file exists"
fi

# Check for required credential files
echo ""
echo "Checking credential files..."

# livestream-link-monitor credentials
if [ ! -f livestream-link-monitor/credentials.json ]; then
    if [ -f livestream-link-monitor/credentials.example.json ]; then
        echo "📝 Creating livestream-link-monitor/credentials.json from example..."
        cp livestream-link-monitor/credentials.example.json livestream-link-monitor/credentials.json
        echo "⚠️  Please update livestream-link-monitor/credentials.json with your Google service account"
    else
        echo "⚠️  Missing: livestream-link-monitor/credentials.json"
        echo "   Please add your Google service account credentials"
    fi
else
    echo "✅ livestream-link-monitor/credentials.json exists"
fi

# livesheet-checker credentials
if [ ! -f livesheet-checker/creds.json ]; then
    if [ -f livesheet-checker/creds.example.json ]; then
        echo "📝 Creating livesheet-checker/creds.json from example..."
        cp livesheet-checker/creds.example.json livesheet-checker/creds.json
        echo "⚠️  Please update livesheet-checker/creds.json with your Google service account"
    else
        echo "⚠️  Missing: livesheet-checker/creds.json"
        echo "   Please add your Google service account credentials"
    fi
else
    echo "✅ livesheet-checker/creds.json exists"
fi

# StreamSource .env
if [ ! -f streamsource/.env ]; then
    echo "📝 Creating streamsource/.env file..."
    
    # Use the same secrets from main .env if available
    if [ -f .env ]; then
        source .env
    fi
    
    cat > streamsource/.env << EOF
# StreamSource Development Environment
RAILS_ENV=development
DATABASE_URL=postgresql://streamsource:streamsource_password@postgres:5432/streamsource_development
REDIS_URL=redis://redis:6379/0
SECRET_KEY_BASE=${SECRET_KEY_BASE:-$(openssl rand -hex 64)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
EOF
    echo "✅ Created streamsource/.env with secure defaults"
else
    echo "✅ streamsource/.env exists"
fi

echo ""
echo "🏗️  Building Docker images..."
docker-compose build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Add Google service account credentials if needed"
echo "3. Run 'make up' or 'docker-compose up -d' to start all services"
echo "4. Run 'make logs' to view service logs"
echo ""
echo "For more information, see README.md and DOCKER-COMPOSE.md"