# Streamwall Suite
# Usage: make [command]

.PHONY: help up down logs status clean

help:
	@echo "Commands:"
	@echo "  up      - Start all services"
	@echo "  down    - Stop all services"
	@echo "  logs    - View logs"
	@echo "  status  - Check status"
	@echo "  clean   - Remove everything"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

status:
	docker compose ps

clean:
	docker compose down -v