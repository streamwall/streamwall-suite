# Streamwall Ecosystem Makefile
# This Makefile orchestrates all services in the Streamwall ecosystem

# Colors for pretty output
RESET := \033[0m
BOLD := \033[1m
DIM := \033[2m
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
MAGENTA := \033[35m
CYAN := \033[36m
WHITE := \033[37m

# Service directories
MONITOR_DIR := livestream-link-monitor
CHECKER_DIR := livesheet-checker
SOURCE_DIR := streamsource
WALL_DIR := streamwall

# Check which services exist
HAS_MONITOR := $(shell test -d $(MONITOR_DIR) && echo 1)
HAS_CHECKER := $(shell test -d $(CHECKER_DIR) && echo 1)
HAS_SOURCE := $(shell test -d $(SOURCE_DIR) && echo 1)
HAS_WALL := $(shell test -d $(WALL_DIR) && echo 1)

# Default target
.DEFAULT_GOAL := help

# Include .env file if it exists
-include .env

##@ General

.PHONY: help
help: ## Display this help
	@echo "$(BOLD)Streamwall Ecosystem$(RESET)"
	@echo "$(DIM)Manage all services in the Streamwall ecosystem$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(CYAN)<target>$(RESET)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(DIM)Quick shortcuts:$(RESET)"
	@echo "  $(CYAN)d$(RESET) → dev    $(CYAN)u$(RESET) → up    $(CYAN)l$(RESET) → logs    $(CYAN)r$(RESET) → restart    $(CYAN)s$(RESET) → status"

##@ Setup

.PHONY: setup
setup: ## Initial setup for all services
	@echo "$(BOLD)$(BLUE)Setting up Streamwall ecosystem...$(RESET)"
ifdef HAS_MONITOR
	@echo "$(YELLOW)Setting up livestream-link-monitor...$(RESET)"
	@cd $(MONITOR_DIR) && make setup
endif
ifdef HAS_CHECKER
	@echo "$(YELLOW)Setting up livesheet-checker...$(RESET)"
	@cd $(CHECKER_DIR) && npm install
endif
ifdef HAS_SOURCE
	@echo "$(YELLOW)Setting up streamsource...$(RESET)"
	@cd $(SOURCE_DIR) && bundle install
endif
ifdef HAS_WALL
	@echo "$(YELLOW)Setting up streamwall...$(RESET)"
	@cd $(WALL_DIR) && npm install
endif
	@echo "$(GREEN)✓ Setup complete!$(RESET)"

.PHONY: setup-integration
setup-integration: ## Setup integration testing framework
	@echo "$(BOLD)$(BLUE)Setting up integration testing...$(RESET)"
	@npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
	@echo "$(GREEN)✓ Integration testing setup complete!$(RESET)"

##@ Development

.PHONY: dev d
dev d: ## Start all services in development mode
	@echo "$(BOLD)$(GREEN)Starting all services in development mode...$(RESET)"
	@$(MAKE) dev-monitor &
	@$(MAKE) dev-checker &
	@$(MAKE) dev-source &
	@$(MAKE) dev-wall &
	@wait
	@echo "$(GREEN)✓ All services started!$(RESET)"

.PHONY: dev-monitor
dev-monitor: ## Start livestream-link-monitor only
ifdef HAS_MONITOR
	@echo "$(YELLOW)Starting livestream-link-monitor...$(RESET)"
	@cd $(MONITOR_DIR) && make dev
else
	@echo "$(RED)livestream-link-monitor not found$(RESET)"
endif

.PHONY: dev-checker
dev-checker: ## Start livesheet-checker only
ifdef HAS_CHECKER
	@echo "$(YELLOW)Starting livesheet-checker...$(RESET)"
	@cd $(CHECKER_DIR) && docker-compose up
else
	@echo "$(RED)livesheet-checker not found$(RESET)"
endif

.PHONY: dev-source
dev-source: ## Start streamsource only
ifdef HAS_SOURCE
	@echo "$(YELLOW)Starting streamsource...$(RESET)"
	@cd $(SOURCE_DIR) && docker-compose up
else
	@echo "$(RED)streamsource not found$(RESET)"
endif

.PHONY: dev-wall
dev-wall: ## Start streamwall only
ifdef HAS_WALL
	@echo "$(YELLOW)Starting streamwall...$(RESET)"
	@cd $(WALL_DIR) && npm run start:app
else
	@echo "$(RED)streamwall not found$(RESET)"
endif

##@ Production

.PHONY: up u
up u: ## Start all services in production mode
	@echo "$(BOLD)$(GREEN)Starting all services in production mode...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && docker-compose up -d
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && docker-compose up -d
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && docker-compose up -d
endif
ifdef HAS_WALL
	@echo "$(YELLOW)Note: Streamwall runs as desktop app$(RESET)"
endif
	@echo "$(GREEN)✓ All services started!$(RESET)"

.PHONY: down
down: ## Stop all services
	@echo "$(BOLD)$(RED)Stopping all services...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && docker-compose down
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && docker-compose down
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && docker-compose down
endif
	@echo "$(GREEN)✓ All services stopped!$(RESET)"

.PHONY: restart r
restart r: down up ## Restart all services

##@ Monitoring

.PHONY: status s
status s: ## Show status of all services
	@echo "$(BOLD)Service Status:$(RESET)"
ifdef HAS_MONITOR
	@echo -n "$(CYAN)livestream-link-monitor:$(RESET) "
	@cd $(MONITOR_DIR) && docker-compose ps --quiet livestream-link-monitor > /dev/null 2>&1 && echo "$(GREEN)running$(RESET)" || echo "$(RED)stopped$(RESET)"
endif
ifdef HAS_CHECKER
	@echo -n "$(CYAN)livesheet-checker:$(RESET) "
	@cd $(CHECKER_DIR) && docker-compose ps --quiet livesheet-checker > /dev/null 2>&1 && echo "$(GREEN)running$(RESET)" || echo "$(RED)stopped$(RESET)"
endif
ifdef HAS_SOURCE
	@echo -n "$(CYAN)streamsource:$(RESET) "
	@cd $(SOURCE_DIR) && docker-compose ps --quiet web > /dev/null 2>&1 && echo "$(GREEN)running$(RESET)" || echo "$(RED)stopped$(RESET)"
endif
ifdef HAS_WALL
	@echo -n "$(CYAN)streamwall:$(RESET) "
	@pgrep -f "electron.*streamwall" > /dev/null && echo "$(GREEN)running$(RESET)" || echo "$(RED)stopped$(RESET)"
endif

.PHONY: logs l
logs l: ## Show logs from all services
	@echo "$(BOLD)$(BLUE)Showing logs from all services...$(RESET)"
	@echo "$(DIM)Press Ctrl+C to exit$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && docker-compose logs -f livestream-link-monitor &
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && docker-compose logs -f livesheet-checker &
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && docker-compose logs -f &
endif
	@wait

.PHONY: logs-monitor
logs-monitor: ## Show livestream-link-monitor logs
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && docker-compose logs -f livestream-link-monitor
endif

.PHONY: logs-checker
logs-checker: ## Show livesheet-checker logs
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && docker-compose logs -f livesheet-checker
endif

.PHONY: logs-source
logs-source: ## Show streamsource logs
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && docker-compose logs -f
endif

##@ Testing

.PHONY: test
test: ## Run tests for all services
	@echo "$(BOLD)$(BLUE)Running tests for all services...$(RESET)"
ifdef HAS_MONITOR
	@echo "$(YELLOW)Testing livestream-link-monitor...$(RESET)"
	@cd $(MONITOR_DIR) && make test
endif
ifdef HAS_WALL
	@echo "$(YELLOW)Testing streamwall...$(RESET)"
	@cd $(WALL_DIR) && npm test
endif
ifdef HAS_SOURCE
	@echo "$(YELLOW)Testing streamsource...$(RESET)"
	@cd $(SOURCE_DIR) && bundle exec rspec
endif
	@echo "$(GREEN)✓ All tests complete!$(RESET)"

.PHONY: test-integration
test-integration: ## Run integration tests
	@echo "$(BOLD)$(BLUE)Running integration tests...$(RESET)"
	@npm run test:integration

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@echo "$(BOLD)$(BLUE)Running end-to-end tests...$(RESET)"
	@npm test -- tests/e2e/

##@ Code Quality

.PHONY: lint
lint: ## Run linters for all services
	@echo "$(BOLD)$(BLUE)Running linters...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && make lint
endif
ifdef HAS_WALL
	@cd $(WALL_DIR) && npm run lint
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && bundle exec rubocop
endif

.PHONY: format
format: ## Format code in all services
	@echo "$(BOLD)$(BLUE)Formatting code...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && make format
endif
ifdef HAS_WALL
	@cd $(WALL_DIR) && npm run format
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && bundle exec rubocop -A
endif

##@ Maintenance

.PHONY: clean
clean: ## Clean build artifacts and dependencies
	@echo "$(BOLD)$(RED)Cleaning build artifacts...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && make clean
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && rm -rf node_modules
endif
ifdef HAS_WALL
	@cd $(WALL_DIR) && npm run clean
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && bundle exec rails tmp:clear
endif

.PHONY: update-deps
update-deps: ## Update dependencies for all services
	@echo "$(BOLD)$(BLUE)Updating dependencies...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && npm update
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && npm update
endif
ifdef HAS_WALL
	@cd $(WALL_DIR) && npm update
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && bundle update
endif

.PHONY: security
security: ## Run security checks
	@echo "$(BOLD)$(BLUE)Running security checks...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && npm audit
endif
ifdef HAS_WALL
	@cd $(WALL_DIR) && npm audit
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && bundle audit
endif

##@ Docker

.PHONY: build
build: ## Build Docker images for all services
	@echo "$(BOLD)$(BLUE)Building Docker images...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && docker-compose build
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && docker-compose build
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && docker-compose build
endif

.PHONY: pull
pull: ## Pull latest Docker images
	@echo "$(BOLD)$(BLUE)Pulling Docker images...$(RESET)"
ifdef HAS_MONITOR
	@cd $(MONITOR_DIR) && docker-compose pull
endif
ifdef HAS_CHECKER
	@cd $(CHECKER_DIR) && docker-compose pull
endif
ifdef HAS_SOURCE
	@cd $(SOURCE_DIR) && docker-compose pull
endif

##@ Troubleshooting

.PHONY: doctor
doctor: ## Diagnose common issues
	@echo "$(BOLD)$(BLUE)Running diagnostics...$(RESET)"
	@echo ""
	@echo "$(CYAN)Checking service directories:$(RESET)"
	@test -d $(MONITOR_DIR) && echo "✓ $(MONITOR_DIR) exists" || echo "✗ $(MONITOR_DIR) missing"
	@test -d $(CHECKER_DIR) && echo "✓ $(CHECKER_DIR) exists" || echo "✗ $(CHECKER_DIR) missing"
	@test -d $(SOURCE_DIR) && echo "✓ $(SOURCE_DIR) exists" || echo "✗ $(SOURCE_DIR) missing"
	@test -d $(WALL_DIR) && echo "✓ $(WALL_DIR) exists" || echo "✗ $(WALL_DIR) missing"
	@echo ""
	@echo "$(CYAN)Checking Docker:$(RESET)"
	@command -v docker >/dev/null 2>&1 && echo "✓ Docker installed" || echo "✗ Docker not found"
	@docker info >/dev/null 2>&1 && echo "✓ Docker daemon running" || echo "✗ Docker daemon not running"
	@echo ""
	@echo "$(CYAN)Checking Node.js:$(RESET)"
	@command -v node >/dev/null 2>&1 && echo "✓ Node.js installed ($(shell node --version))" || echo "✗ Node.js not found"
	@command -v npm >/dev/null 2>&1 && echo "✓ npm installed ($(shell npm --version))" || echo "✗ npm not found"
	@echo ""
ifdef HAS_SOURCE
	@echo "$(CYAN)Checking Ruby:$(RESET)"
	@command -v ruby >/dev/null 2>&1 && echo "✓ Ruby installed ($(shell ruby --version | cut -d' ' -f2))" || echo "✗ Ruby not found"
	@command -v bundle >/dev/null 2>&1 && echo "✓ Bundler installed" || echo "✗ Bundler not found"
endif

.PHONY: env-check
env-check: ## Check environment variables
	@echo "$(BOLD)$(BLUE)Checking environment configuration...$(RESET)"
ifdef HAS_MONITOR
	@echo "$(CYAN)livestream-link-monitor:$(RESET)"
	@test -f $(MONITOR_DIR)/.env && echo "✓ .env file exists" || echo "✗ .env file missing"
endif
ifdef HAS_CHECKER
	@echo "$(CYAN)livesheet-checker:$(RESET)"
	@test -f $(CHECKER_DIR)/creds.json && echo "✓ creds.json exists" || echo "✗ creds.json missing"
endif
ifdef HAS_SOURCE
	@echo "$(CYAN)streamsource:$(RESET)"
	@test -f $(SOURCE_DIR)/.env && echo "✓ .env file exists" || echo "✗ .env file missing"
endif

.PHONY: health
health: ## Health check all services
	@echo "$(BOLD)$(BLUE)Checking service health...$(RESET)"
ifdef HAS_MONITOR
	@echo -n "$(CYAN)livestream-link-monitor:$(RESET) "
	@curl -s http://localhost:3000/health >/dev/null 2>&1 && echo "$(GREEN)healthy$(RESET)" || echo "$(RED)unhealthy$(RESET)"
endif
ifdef HAS_SOURCE
	@echo -n "$(CYAN)streamsource:$(RESET) "
	@curl -s http://localhost:3000/up >/dev/null 2>&1 && echo "$(GREEN)healthy$(RESET)" || echo "$(RED)unhealthy$(RESET)"
endif

##@ Shortcuts

.PHONY: d u l r s
# Shortcuts are defined with their full versions above