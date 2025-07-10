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
		$(MAKE) up; \
		echo ""; \
		echo "$(CYAN)Demo mode active. Run '$(BOLD)make help$(RESET)$(CYAN)' for more options.$(RESET)"; \
	else \
		$(MAKE) up; \
	fi

.PHONY: demo
demo: ## Quick demo with sample data (great for trying it out)
	@echo "$(BOLD)$(CYAN)Starting Demo Mode...$(RESET)"
	@$(MAKE) _create-demo-env
	@cp .env.demo .env
	@docker compose down 2>/dev/null || true
	@COMPOSE_PROFILES="demo,development" docker compose up -d
	@echo ""
	@echo "$(GREEN)✅ Demo started!$(RESET)"
	@echo ""
	@echo "$(CYAN)Access:$(RESET) http://localhost:3100/admin"
	@echo "$(CYAN)Login:$(RESET) admin@example.com / Password123!"

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
	@echo "$(BOLD)$(GREEN)Starting services...$(RESET)"
	@docker compose up -d
	@echo "$(GREEN)✅ Services started!$(RESET)"

.PHONY: down
down: ## Stop all services
	@echo "$(BOLD)$(RED)Stopping services...$(RESET)"
	@docker compose down
	@echo "$(GREEN)✅ Services stopped!$(RESET)"

.PHONY: restart
restart: down up ## Restart all services

.PHONY: status
status: ## Show service status
	@echo "$(BOLD)Service Status:$(RESET)"
	@docker compose ps

.PHONY: logs
logs: ## Show logs (use with SERVICE=name for specific service)
ifdef SERVICE
	@docker compose logs -f $(SERVICE)
else
	@docker compose logs -f
endif

.PHONY: shell
shell: ## Open shell in service (use with SERVICE=name, default: streamsource)
	@docker compose exec $(or $(SERVICE),streamsource) bash || docker compose exec $(or $(SERVICE),streamsource) sh

##@ Maintenance

.PHONY: validate
validate: ## Check configuration
	@if [ -f ./bin/streamwall-validate ]; then \
		./bin/streamwall-validate; \
	else \
		echo "$(CYAN)Checking configuration...$(RESET)"; \
		[ -f .env ] && echo "$(GREEN)✓ .env exists$(RESET)" || echo "$(RED)✗ .env missing$(RESET)"; \
		docker info >/dev/null 2>&1 && echo "$(GREEN)✓ Docker running$(RESET)" || echo "$(RED)✗ Docker not running$(RESET)"; \
	fi

.PHONY: update
update: ## Update submodules and dependencies
	@echo "$(BOLD)$(BLUE)Updating...$(RESET)"
	@git submodule update --init --recursive
	@docker compose pull
	@echo "$(GREEN)✅ Updated!$(RESET)"

.PHONY: clean
clean: ## Clean up containers and volumes (WARNING: deletes data)
	@echo "$(BOLD)$(RED)This will delete all data!$(RESET)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v; \
		echo "$(GREEN)✅ Cleaned!$(RESET)"; \
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
	@echo "# Security (demo only)" >> .env.demo
	@echo "SECRET_KEY_BASE=demo_secret_$$(date +%s)" >> .env.demo
	@echo "JWT_SECRET=demo_jwt_$$(date +%s)" >> .env.demo
	@echo "STREAMSOURCE_API_KEY=demo_api_$$(date +%s)" >> .env.demo
	@echo "" >> .env.demo
	@echo "# Services" >> .env.demo
	@echo "REDIS_URL=redis://redis:6379/0" >> .env.demo
	@echo "BACKEND_TYPE=streamsource" >> .env.demo