# One entry point for local development (see docs/decisions.md).
# Parts that are not scaffolded yet are skipped with a note instead of failing.

# Export the root .env so the API (and later the other apps) see the same settings as Postgres.
-include .env
export

# The API builds with JDK 21 (see docs/decisions.md). On macOS, use it even if a newer JDK is the default.
ifeq ($(shell uname),Darwin)
JDK21 := $(shell /usr/libexec/java_home -v 21 2>/dev/null)
ifneq ($(JDK21),)
export JAVA_HOME := $(JDK21)
endif
endif

# Compose looks for .env next to the compose file, so pass the root .env explicitly.
COMPOSE := docker compose $(if $(wildcard .env),--env-file .env) -f infra/docker-compose.yml

.DEFAULT_GOAL := help
.PHONY: help dev db db-reset psql stop api-client lint format test

help: ## Show available commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-9s %s\n", $$1, $$2}'

db: ## Start PostgreSQL in Docker and wait until it is ready
	@if [ -f infra/docker-compose.yml ]; then $(COMPOSE) up -d --wait; \
	else echo "skip  postgres      not scaffolded yet (see #2)"; fi

db-reset: ## Delete the local database and start an empty one
	$(COMPOSE) down -v
	@$(MAKE) --no-print-directory db

psql: ## Open a psql shell on the local database
	@$(COMPOSE) exec postgres sh -c 'psql -U "$$POSTGRES_USER" "$$POSTGRES_DB"'

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

stop: ## Stop the database (data is kept)
	@if [ -f infra/docker-compose.yml ]; then $(COMPOSE) down; fi

api-client: ## Export the OpenAPI spec from the API and regenerate packages/api-client (needs Docker)
	cd apps/api && ./mvnw -q test -Dtest=OpenApiSpecExportTest -Dsurefire.failIfNoSpecifiedTests=false
	npm run generate -w @tavolina/api-client

lint: ## Lint and format-check everything (ESLint, Prettier, TS types, Spotless)
	npm run lint
	npm run format:check
	npm run typecheck
	cd apps/api && ./mvnw -q spotless:check

format: ## Format all code (Prettier and Spotless)
	npm run format
	cd apps/api && ./mvnw -q spotless:apply

test: ## Run every test suite (TS workspaces, then the API; the API needs Docker)
	npm test
	cd apps/api && ./mvnw -q verify
