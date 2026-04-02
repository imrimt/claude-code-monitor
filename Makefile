.PHONY: help dev build start serve test test-watch coverage lint lint-fix format typecheck setup clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Development mode with hot reload
	npm run dev

build: ## TypeScript compilation
	npm run build

start: ## Run compiled server
	npm start

serve: build ## Build and start web server
	node dist/bin/ccm.js serve

test: ## Run tests
	npm run test

test-watch: ## Run tests in watch mode
	npm run test:watch

coverage: ## Run tests with coverage
	npm run test:coverage

lint: ## Lint check
	npm run lint

lint-fix: ## Auto-fix lint issues
	npm run lint:fix

format: ## Format code
	npm run format

typecheck: ## Type checking
	npm run typecheck

setup: build ## Build and configure hooks
	node dist/bin/ccm.js setup

clean: ## Remove build artifacts
	rm -rf dist
