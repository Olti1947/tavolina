# One entry point for local development (see docs/decisions.md).
# Parts that are not scaffolded yet are skipped with a note instead of failing.

COMPOSE := docker compose -f infra/docker-compose.yml

.DEFAULT_GOAL := help
.PHONY: help dev db stop

help: ## Show available commands
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-6s %s\n", $$1, $$2}'

db: ## Start PostgreSQL in Docker
	@if [ -f infra/docker-compose.yml ]; then $(COMPOSE) up -d; \
	else echo "skip  postgres      not scaffolded yet (see #2)"; fi

dev: db ## Start the database, API, admin app and fake printer
	@started=0; \
	trap 'trap - INT TERM; kill 0' INT TERM; \
	if [ -f apps/api/mvnw ]; then (cd apps/api && ./mvnw -q spring-boot:run) & started=1; \
	else echo "skip  api           not scaffolded yet (see #2)"; fi; \
	if [ -f apps/admin/package.json ]; then (cd apps/admin && npm run dev) & started=1; \
	else echo "skip  admin         not scaffolded yet (see #3)"; fi; \
	if [ -f tools/fake-printer/package.json ]; then (cd tools/fake-printer && npm start) & started=1; \
	else echo "skip  fake-printer  not scaffolded yet (see #4)"; fi; \
	if [ $$started -eq 1 ]; then wait; else echo "Nothing to run yet."; fi

stop: ## Stop the database
	@if [ -f infra/docker-compose.yml ]; then $(COMPOSE) down; fi
