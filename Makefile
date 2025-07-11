# Streamwall - Unified Control Center
# Just run 'make' to get started!

# Colors
RESET := \033[0m
BOLD := \033[1m
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
CYAN := \033[36m

# Default target - smart interactive mode
.DEFAULT_GOAL := start

# Include .env if it exists
-include .env

# Environment detection
ENV ?= development
COMPOSE_FILE := docker-compose.yml
COMPOSE_SERVICES :=

ifeq ($(ENV),production)
	COMPOSE_FILE := docker-compose.yml -f docker-compose.prod.yml
	COMPOSE_PROFILES := production
else ifeq ($(ENV),demo)
	COMPOSE_PROFILES := demo
	COMPOSE_SERVICES := postgres redis streamsource-demo livestream-monitor-demo livesheet-updater-demo
else
	COMPOSE_PROFILES := development
	COMPOSE_SERVICES := postgres redis streamsource livestream-monitor livesheet-updater
endif

##@ Getting Started

.PHONY: start
start: ## Smart start - detects best mode and guides you
	@if [ ! -f .env ] && [ ! -f .setup-complete ]; then \
		echo "$(BOLD)$(YELLOW)Welcome to Streamwall!$(RESET)"; \
		echo ""; \
		echo "Choose an option:"; \
		echo "  $(BOLD)1)$(RESET) Demo mode - Try it out with sample data"; \
		echo "  $(BOLD)2)$(RESET) Setup mode - Configure for real use"; \
		echo ""; \
		read -p "Enter choice [1]: " choice; \
		case $$choice in \
			2) $(MAKE) setup ;; \
			*) $(MAKE) demo ;; \
		esac; \
	elif grep -q "DEMO_MODE=true" .env 2>/dev/null; then \
		ENV=demo $(MAKE) up; \
	else \
		$(MAKE) up; \
	fi

.PHONY: demo
demo: ## Quick demo with sample data (great for trying it out)
	@echo "$(BOLD)$(CYAN)Starting Demo Mode...$(RESET)"
	@if [ -f .env ] && ! grep -q "DEMO_MODE=true" .env 2>/dev/null; then \
		echo ""; \
		echo "$(YELLOW)⚠️  Found existing .env file (non-demo)$(RESET)"; \
		echo "This might cause conflicts with demo mode."; \
		echo ""; \
		read -p "Replace with demo configuration? (y/N) " -n 1 -r; \
		echo; \
		if [[ ! $$REPLY =~ ^[Yy]$$ ]]; then \
			echo "$(RED)Demo cancelled$(RESET)"; \
			echo "Run '$(BOLD)make reset-env$(RESET)' to clear configuration"; \
			exit 1; \
		fi; \
	fi
	@if [ ! -f .env.demo ]; then \
		$(MAKE) _create-demo-env; \
	fi
	@cp .env.demo .env
	@docker compose down 2>/dev/null || true
	@COMPOSE_PROFILES="demo" docker compose up -d
	@ENV=demo $(MAKE) _show-urls

.PHONY: setup
setup: ## Interactive setup wizard for production use
	@echo "$(BOLD)$(BLUE)Starting Setup Wizard...$(RESET)"
	@if [ -f ./bin/streamwall-setup-wizard ]; then \
		./bin/streamwall-setup-wizard; \
	else \
		echo "$(YELLOW)Creating basic .env file...$(RESET)"; \
		cp .env.example .env 2>/dev/null || echo "# Streamwall Config" > .env; \
		echo "$(GREEN)✓ Done! Edit .env to customize.$(RESET)"; \
	fi

##@ Core Commands

.PHONY: up
up: ## Start all services
	@echo "$(BOLD)$(GREEN)Starting $(ENV) services...$(RESET)"
ifeq ($(ENV),demo)
	@COMPOSE_PROFILES="$(COMPOSE_PROFILES)" docker compose -f $(COMPOSE_FILE) up -d --remove-orphans $(COMPOSE_SERVICES)
else ifeq ($(ENV),development)
	@docker compose -f $(COMPOSE_FILE) up -d --remove-orphans $(COMPOSE_SERVICES)
else
	@COMPOSE_PROFILES="$(COMPOSE_PROFILES)" docker compose -f $(COMPOSE_FILE) up -d --remove-orphans
endif
	@echo "$(GREEN)✅ $(ENV) services started!$(RESET)"
	@$(MAKE) _show-urls

.PHONY: down
down: ## Stop all services
	@echo "$(BOLD)$(RED)Stopping services...$(RESET)"
	@docker compose down --remove-orphans 2>/dev/null || true
	@COMPOSE_PROFILES="development" docker compose down --remove-orphans 2>/dev/null || true
	@COMPOSE_PROFILES="demo" docker compose down --remove-orphans 2>/dev/null || true
	@COMPOSE_PROFILES="production" docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
	@echo "$(GREEN)✅ All services stopped!$(RESET)"

.PHONY: restart
restart: down up ## Restart all services

.PHONY: status
status: ## Show service status
	@echo "$(BOLD)Service Status:$(RESET)"
	@docker compose ps
	@COMPOSE_PROFILES="development" docker compose ps 2>/dev/null || true

.PHONY: logs
logs: ## Show logs (use with SERVICE=name for specific service)
ifdef SERVICE
	@COMPOSE_PROFILES="$(COMPOSE_PROFILES)" docker compose -f $(COMPOSE_FILE) logs -f $(SERVICE)
else
	@COMPOSE_PROFILES="$(COMPOSE_PROFILES)" docker compose -f $(COMPOSE_FILE) logs -f
endif

.PHONY: shell
shell: ## Open shell in service (use with SERVICE=name, default: streamsource)
	@COMPOSE_PROFILES="$(COMPOSE_PROFILES)" docker compose -f $(COMPOSE_FILE) exec $(or $(SERVICE),streamsource) bash || COMPOSE_PROFILES="$(COMPOSE_PROFILES)" docker compose -f $(COMPOSE_FILE) exec $(or $(SERVICE),streamsource) sh

##@ Production Commands

.PHONY: prod-up
prod-up: ## Start production services
	@ENV=production $(MAKE) up

.PHONY: prod-down
prod-down: ## Stop production services
	@ENV=production $(MAKE) down

.PHONY: prod-logs
prod-logs: ## Show production logs
	@ENV=production $(MAKE) logs

.PHONY: prod-status
prod-status: ## Show production service status
	@echo "$(BOLD)Production Service Status:$(RESET)"
	@ENV=production COMPOSE_PROFILES="production" docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

.PHONY: prod-deploy
prod-deploy: ## Deploy to production (with checks)
	@echo "$(BOLD)$(BLUE)Production Deployment$(RESET)"
	@echo "Checking prerequisites..."
	@if [ ! -f ./secrets/postgres_password.txt ]; then \
		echo "$(RED)✗ Missing secrets/postgres_password.txt$(RESET)"; \
		echo "Run 'make prod-setup' first"; \
		exit 1; \
	fi
	@echo "$(GREEN)✓ Secrets configured$(RESET)"
	@echo ""
	@echo "$(YELLOW)This will deploy to PRODUCTION!$(RESET)"
	@read -p "Are you sure? (yes/N) " -r; \
	echo; \
	if [[ $$REPLY == "yes" ]]; then \
		ENV=production $(MAKE) update; \
		ENV=production $(MAKE) up; \
		echo "$(GREEN)✅ Production deployed!$(RESET)"; \
	else \
		echo "$(YELLOW)Deployment cancelled$(RESET)"; \
	fi

.PHONY: prod-setup
prod-setup: ## Setup production environment
	@echo "$(BOLD)$(BLUE)Production Setup$(RESET)"
	@mkdir -p secrets
	@if [ ! -f ./secrets/postgres_password.txt ]; then \
		echo "Generating secure passwords..."; \
		openssl rand -base64 32 > ./secrets/postgres_password.txt; \
		openssl rand -base64 32 > ./secrets/secret_key_base.txt; \
		openssl rand -base64 32 > ./secrets/jwt_secret.txt; \
		openssl rand -base64 32 > ./secrets/api_key.txt; \
		openssl rand -base64 32 > ./secrets/grafana_password.txt; \
		echo "$(GREEN)✓ Secrets generated$(RESET)"; \
	else \
		echo "$(YELLOW)Secrets already exist$(RESET)"; \
	fi
	@if [ ! -f .env.production ]; then \
		cp .env.production.example .env.production 2>/dev/null || \
		echo "# Production Environment" > .env.production; \
		echo "$(GREEN)✓ Created .env.production$(RESET)"; \
	fi
	@echo ""
	@echo "$(GREEN)Production setup complete!$(RESET)"
	@echo "Next steps:"
	@echo "  1. Edit .env.production with your settings"
	@echo "  2. Add Discord token to secrets/discord_token.txt"
	@echo "  3. Run 'make prod-deploy' when ready"

.PHONY: prod-backup
prod-backup: ## Backup production database
	@echo "$(BOLD)$(BLUE)Backing up production database...$(RESET)"
	@mkdir -p backups
	@ENV=production COMPOSE_PROFILES="production" docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres pg_dump -U ${POSTGRES_USER:-streamwall} ${POSTGRES_DB:-streamwall_production} | gzip > backups/streamwall_prod_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "$(GREEN)✅ Backup complete!$(RESET)"

.PHONY: prod-restore
prod-restore: ## Restore production database (use with BACKUP=filename)
ifndef BACKUP
	@echo "$(RED)Please specify BACKUP=filename$(RESET)"
	@echo "Available backups:"
	@ls -la backups/*.sql.gz 2>/dev/null || echo "No backups found"
else
	@echo "$(BOLD)$(RED)WARNING: This will restore production database!$(RESET)"
	@read -p "Are you sure? (yes/N) " -r; \
	echo; \
	if [[ $$REPLY == "yes" ]]; then \
		gunzip -c $(BACKUP) | ENV=production COMPOSE_PROFILES="production" docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres psql -U ${POSTGRES_USER:-streamwall} ${POSTGRES_DB:-streamwall_production}; \
		echo "$(GREEN)✅ Database restored!$(RESET)"; \
	fi
endif

##@ Quick Actions

.PHONY: admin-setup
admin-setup: ## Create admin account for StreamSource
	@echo "$(BOLD)$(BLUE)Creating StreamSource admin account...$(RESET)"
	@docker compose exec streamsource bundle exec rails runner 'u = User.find_or_initialize_by(email: "admin@example.com"); u.password = "Password123"; u.password_confirmation = "Password123"; u.role = "admin"; u.save!; puts u.persisted? ? "Admin account ready" : "Failed to create admin"'
	@echo ""
	@echo "$(GREEN)✅ Admin account ready!$(RESET)"
	@echo "Email: $(BOLD)admin@example.com$(RESET)"
	@echo "Password: $(BOLD)Password123$(RESET)"
	@echo ""
	@echo "$(YELLOW)⚠️  Change this password after first login!$(RESET)"

.PHONY: test-stream
test-stream: ## Add a test stream via API
	@echo "$(BOLD)$(BLUE)Adding test stream...$(RESET)"
	@echo "Using service account API key..."
	@RESULT=$$(curl -s -X POST http://localhost:$${STREAMSOURCE_PORT:-3000}/api/v1/streams \
		-H "Content-Type: application/json" \
		-H "X-API-Key: $${STREAMSOURCE_API_KEY:-development_api_key_at_least_30_characters_long}" \
		-d '{"stream": {"url": "https://twitch.tv/test_stream_'$$(date +%s)'", "title": "Test Stream '$(date +%Y-%m-%d)'", "platform": "twitch", "streamer_name": "TestStreamer'$$(date +%s)'", "location": {"city": "New York", "state_province": "NY", "country": "US"}}}' 2>&1); \
	if echo "$$RESULT" | jq -e '.data' >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Stream added successfully!$(RESET)"; \
		echo ""; \
		echo "$$RESULT" | jq '.data' 2>/dev/null || echo "$$RESULT"; \
	else \
		echo "$(RED)Failed to add stream:$(RESET)"; \
		echo "$$RESULT" | jq '.' 2>/dev/null || echo "$$RESULT"; \
		echo ""; \
		echo "$(YELLOW)Note: You may need to create a service account first.$(RESET)"; \
	fi

.PHONY: service-account
service-account: ## Create service account for API access
	@echo "$(BOLD)$(BLUE)Creating service account...$(RESET)"
	@docker compose exec streamsource bundle exec rails runner 'u = User.find_or_initialize_by(email: "service@streamwall.local"); u.password = "ServicePass123"; u.password_confirmation = "ServicePass123"; u.role = "service"; u.service_account = true; u.save!; puts u.persisted? ? "Service account created" : "Failed"'
	@echo ""
	@echo "$(GREEN)✅ Service account ready!$(RESET)"
	@echo "Email: $(BOLD)service@streamwall.local$(RESET)"
	@echo "Password: $(BOLD)ServicePass123$(RESET)"
	@echo ""
	@echo "Use these credentials in livestream-monitor and livesheet-updater"

.PHONY: mock-discord
mock-discord: ## Simulate Discord stream message
	@echo "$(BOLD)$(BLUE)Simulating Discord stream post...$(RESET)"
	@echo "This would post: 'Check out this stream: https://twitch.tv/awesome_streamer'"
	@echo ""
	@echo "$(YELLOW)Note: Discord monitoring requires bot setup.$(RESET)"
	@echo "See: livestream-link-monitor/README.md"

##@ Maintenance

.PHONY: reset-env
reset-env: ## Reset environment configuration (.env file)
	@if [ -f .env ]; then \
		echo "$(BOLD)$(YELLOW)This will remove your .env file$(RESET)"; \
		echo "Use this when switching between demo/development modes"; \
		echo ""; \
		read -p "Remove .env? (y/N) " -n 1 -r; \
		echo; \
		if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
			rm -f .env; \
			echo "$(GREEN)✅ Environment reset!$(RESET)"; \
			echo ""; \
			echo "Now you can run:"; \
			echo "  $(BOLD)make$(RESET) - For development mode"; \
			echo "  $(BOLD)make demo$(RESET) - For demo mode"; \
		else \
			echo "$(YELLOW)Cancelled$(RESET)"; \
		fi; \
	else \
		echo "$(YELLOW)No .env file found$(RESET)"; \
	fi

.PHONY: validate
validate: ## Check configuration
	@if [ -f ./bin/streamwall-validate ]; then \
		./bin/streamwall-validate; \
	else \
		echo "$(CYAN)Checking configuration...$(RESET)"; \
		[ -f .env ] && echo "$(GREEN)✓ .env exists$(RESET)" || echo "$(RED)✗ .env missing$(RESET)"; \
		docker info >/dev/null 2>&1 && echo "$(GREEN)✓ Docker running$(RESET)" || echo "$(RED)✗ Docker not running$(RESET)"; \
	fi

.PHONY: test
test: ## Run tests for all services
	@echo "$(BOLD)$(BLUE)Running tests...$(RESET)"
	@if [ -d streamsource ]; then \
		echo "$(CYAN)Testing StreamSource...$(RESET)"; \
		cd streamsource && bundle exec rspec || true; \
	fi
	@if [ -d livestream-link-monitor ]; then \
		echo "$(CYAN)Testing Monitor...$(RESET)"; \
		cd livestream-link-monitor && npm test || true; \
	fi
	@echo "$(GREEN)✓ Tests complete!$(RESET)"

.PHONY: update
update: ## Update submodules and dependencies
	@echo "$(BOLD)$(BLUE)Updating...$(RESET)"
	@git submodule update --init --recursive
	@docker compose pull
	@echo "$(GREEN)✅ Updated!$(RESET)"

.PHONY: clean
clean: ## Clean up containers, volumes, and config (WARNING: deletes all data)
	@echo "$(BOLD)$(RED)This will delete all data and configuration!$(RESET)"
	@echo "This includes:"
	@echo "  • All Docker containers and volumes"
	@echo "  • Database data"
	@echo "  • Redis data"
	@if [ -f .env ]; then \
		echo "  • $(YELLOW).env configuration file$(RESET)"; \
	fi
	@echo ""
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "$(YELLOW)Stopping services...$(RESET)"; \
		docker compose down -v 2>/dev/null || true; \
		COMPOSE_PROFILES="development" docker compose down -v 2>/dev/null || true; \
		COMPOSE_PROFILES="demo" docker compose down -v 2>/dev/null || true; \
		docker ps --format '{{.Names}}' | grep -E '(streamwall|streamsource|livestream|livesheet)' | xargs docker stop 2>/dev/null || true; \
		docker ps -a --format '{{.Names}}' | grep -E '(streamwall|streamsource|livestream|livesheet)' | xargs docker rm 2>/dev/null || true; \
		docker volume ls --format '{{.Name}}' | grep -E '(streamwall|streamsource|livestream|livesheet)' | xargs docker volume rm 2>/dev/null || true; \
		if [ -f .env ]; then \
			echo ""; \
			read -p "Also remove .env file? (y/N) " -n 1 -r; \
			echo; \
			if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
				rm -f .env; \
				echo "$(GREEN)✓ Removed .env$(RESET)"; \
			else \
				echo "$(YELLOW)ℹ Kept .env file$(RESET)"; \
				echo "$(YELLOW)  Note: You may want to remove it manually if switching modes$(RESET)"; \
			fi; \
		fi; \
		echo ""; \
		echo "$(GREEN)✅ Cleanup complete!$(RESET)"; \
	else \
		echo "$(YELLOW)Cleanup cancelled$(RESET)"; \
	fi

.PHONY: help
help: ## Show this help
	@echo "$(BOLD)Streamwall Commands$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make $(CYAN)<command>$(RESET)\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BOLD)Examples:$(RESET)"
	@echo "  make              # First time? Start here"
	@echo "  make demo         # Try with sample data"
	@echo "  make logs         # View all logs"
	@echo "  make logs SERVICE=streamsource  # View specific service"

##@ Internal Helpers (not shown in help)

# Helper to show service URLs and next steps
.PHONY: _show-urls
_show-urls:
	@echo ""
	@echo "$(BOLD)$(GREEN)🚀 Services are ready!$(RESET)"
	@echo ""
ifeq ($(ENV),demo)
	@echo "$(CYAN)StreamSource Admin:$(RESET) http://localhost:3100/admin"
	@echo "  └─ Login: admin@example.com / Password123!"
	@echo ""
	@echo "$(CYAN)Demo Features:$(RESET)"
	@echo "  • Auto-generates sample streams"
	@echo "  • Pre-configured admin account"
	@echo "  • Mock Discord/Twitch monitoring"
	@echo ""
	@echo "$(CYAN)Try these:$(RESET)"
	@echo "  1. Visit the admin panel above"
	@echo "  2. Watch logs: $(BOLD)make logs$(RESET)"
	@echo "  3. See API docs: http://localhost:3100/api-docs"
else
	@echo "$(CYAN)StreamSource Admin:$(RESET) http://localhost:3000/admin"
	@echo "  └─ First time? Run: $(BOLD)make admin-setup$(RESET)"
	@echo ""
	@echo "$(CYAN)Getting Started:$(RESET)"
	@echo "  1. Create admin: $(BOLD)make admin-setup$(RESET)"
	@echo "  2. Visit admin panel: http://localhost:3000/admin"
	@echo "  3. Create streams manually in the UI"
	@echo ""
	@echo "$(CYAN)For Developers:$(RESET)"
	@echo "  • Rails console: $(BOLD)make shell$(RESET)"
	@echo "  • API docs: http://localhost:3000/api-docs"
	@echo "  • View logs: $(BOLD)make logs$(RESET)"
	@echo ""
	@echo "$(CYAN)Database:$(RESET) postgres://streamwall@localhost:5432"
endif
	@echo ""
	@echo "$(CYAN)Useful Commands:$(RESET)"
	@echo "  $(BOLD)make status$(RESET) - Check service health"
	@echo "  $(BOLD)make logs$(RESET) - View all logs"
	@echo "  $(BOLD)make logs SERVICE=streamsource$(RESET) - View specific service"
	@echo "  $(BOLD)make shell$(RESET) - Rails console"
	@echo "  $(BOLD)make down$(RESET) - Stop all services"
	@echo ""

# Create demo environment
.PHONY: _create-demo-env
_create-demo-env:
	@echo "# Demo Mode Configuration" > .env.demo
	@echo "DEMO_MODE=true" >> .env.demo
	@echo "NODE_ENV=development" >> .env.demo
	@echo "RAILS_ENV=development" >> .env.demo
	@echo "" >> .env.demo
	@echo "# Ports" >> .env.demo
	@echo "DEMO_STREAMSOURCE_PORT=3100" >> .env.demo
	@echo "POSTGRES_PORT=5432" >> .env.demo
	@echo "REDIS_PORT=6379" >> .env.demo
	@echo "" >> .env.demo
	@echo "# Database" >> .env.demo
	@echo "POSTGRES_USER=streamwall" >> .env.demo
	@echo "POSTGRES_PASSWORD=demo_password" >> .env.demo
	@echo "POSTGRES_DB=streamwall_demo" >> .env.demo
	@echo "DATABASE_URL=postgresql://streamwall:demo_password@postgres:5432/streamwall_demo" >> .env.demo
	@echo "" >> .env.demo
	@echo "# Security (demo only - DO NOT USE IN PRODUCTION)" >> .env.demo
	@echo "SECRET_KEY_BASE=demo_secret_key_base_30_characters_long_not_for_production" >> .env.demo
	@echo "JWT_SECRET=demo_jwt_secret_30_characters_long_not_for_production" >> .env.demo
	@echo "STREAMSOURCE_API_KEY=demo_api_key_30_characters_long_not_for_production" >> .env.demo
	@echo "" >> .env.demo
	@echo "# Services" >> .env.demo
	@echo "REDIS_URL=redis://redis:6379/0" >> .env.demo
	@echo "BACKEND_TYPE=streamsource" >> .env.demo