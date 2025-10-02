# LumiNote Makefile
# ================
# 
# This Makefile provides convenient commands for managing the LumiNote
# voice-to-text transcription system project.

# Variables
PYTHON = python3
PIP = pip3
FLASK_APP = app.py
FLASK_ENV = development
PORT = 2429
HOST = 0.0.0.0

# Default target
.PHONY: help
help:
	@echo "LumiNote Voice-to-Text System - Makefile Commands"
	@echo "================================================"
	@echo ""
	@echo "Usage:"
	@echo "  make run           - Start the development server"
	@echo " make run-prod      - Start the production server"
	@echo "  make install       - Install dependencies"
	@echo "  make install-dev   - Install development dependencies"
	@echo "  make test          - Run tests"
	@echo " make test-verbose  - Run tests with verbose output"
	@echo "  make clean         - Clean temporary files"
	@echo " make clean-logs    - Clean log files"
	@echo " make clean-pyc     - Clean Python cache files"
	@echo "  make clean-all     - Clean all temporary files"
	@echo "  make docker-build  - Build Docker image"
	@echo " make docker-run    - Run with Docker"
	@echo " make docker-stop   - Stop Docker container"
	@echo " make docker-clean  - Remove Docker images and containers"
	@echo "  make setup-venv    - Create and setup virtual environment"
	@echo "  make update        - Update dependencies"
	@echo "  make check         - Check code formatting and linting"
	@echo "  make docs          - Generate documentation"
	@echo "  make backup        - Create backup of current state"
	@echo "  make help          - Show this help message"

# Run the application
.PHONY: run
run:
	@echo "Starting LumiNote development server..."
	@$(PYTHON) run.py --config development

# Run production server
.PHONY: run-prod
run-prod:
	@echo "Starting LumiNote production server..."
	@$(PYTHON) run.py --config production

# Install dependencies
.PHONY: install
install:
	@echo "Installing dependencies..."
	@$(PIP) install --upgrade pip
	@$(PIP) install -r requirements.txt
	@echo "Dependencies installed successfully!"

# Install development dependencies
.PHONY: install-dev
install-dev:
	@echo "Installing development dependencies..."
	@$(PIP) install --upgrade pip
	@$(PIP) install -r requirements.txt
	@$(PIP) install pytest black flake8 pylint mypy
	@echo "Development dependencies installed successfully!"

# Run tests
.PHONY: test
test:
	@echo "Running tests..."
	@$(PYTHON) -m pytest tests/ -v

# Run tests with verbose output
.PHONY: test-verbose
test-verbose:
	@echo "Running tests with verbose output..."
	@$(PYTHON) -m pytest tests/ -v -s

# Clean temporary files
.PHONY: clean
clean: clean-pyc clean-logs

# Clean Python cache files
.PHONY: clean-pyc
clean-pyc:
	@echo "Cleaning Python cache files..."
	@find . -type d -name "__pycache__" -delete
	@find . -type f -name "*.pyc" -delete
	@find . -type f -name "*.pyo" -delete
	@find . -type f -name "*~" -delete
	@find . -type f -name ".coverage" -delete
	@find . -type d -name ".pytest_cache" -delete
	@find . -type d -name ".mypy_cache" -delete
	@echo "Python cache files cleaned!"

# Clean log files
.PHONY: clean-logs
clean-logs:
	@echo "Cleaning log files..."
	@rm -f server.log
	@rm -f *.log
	@echo "Log files cleaned!"

# Clean all temporary files
.PHONY: clean-all
clean-all: clean
	@echo "Cleaning all temporary files..."
	@rm -rf .venv/
	@rm -rf venv/
	@rm -rf env/
	@echo "All temporary files cleaned!"

# Docker commands
.PHONY: docker-build
docker-build:
	@echo "Building Docker image..."
	@docker build -t luminote .

.PHONY: docker-run
docker-run:
	@echo "Running Docker container..."
	@docker run -p $(PORT):$(PORT) --name luminote-container luminote

.PHONY: docker-stop
docker-stop:
	@echo "Stopping Docker container..."
	@docker stop luminote-container
	@docker rm luminote-container

.PHONY: docker-clean
docker-clean:
	@echo "Cleaning Docker images and containers..."
	@docker stop luminote-container 2>/dev/null || true
	@docker rm luminote-container 2>/dev/null || true
	@docker rmi luminote 2>/dev/null || true
	@echo "Docker cleaned!"

# Setup virtual environment
.PHONY: setup-venv
setup-venv:
	@echo "Creating virtual environment..."
	@$(PYTHON) -m venv .venv
	@echo "Activating virtual environment and installing dependencies..."
	@source .venv/bin/activate && $(PIP) install --upgrade pip
	@source .venv/bin/activate && $(PIP) install -r requirements.txt
	@echo "Virtual environment created and dependencies installed!"
	@echo "To activate: source .venv/bin/activate"

# Update dependencies
.PHONY: update
update:
	@echo "Updating dependencies..."
	@$(PIP) install --upgrade pip
	@$(PIP) install --upgrade -r requirements.txt
	@echo "Dependencies updated!"

# Check code formatting and linting
.PHONY: check
check:
	@echo "Checking code formatting and linting..."
	@flake8 . --exclude=.git,__pycache__,.venv,venv,env --ignore=E501,W503
	@black --check --exclude="(.git|__pycache__|.venv|venv|env)" .
	@echo "Code check completed!"

# Generate documentation
.PHONY: docs
docs:
	@echo "Generating documentation..."
	@echo "Documentation available in README.md and API.md"
	@echo "Configuration documentation available in config.py"

# Create backup
.PHONY: backup
backup:
	@echo "Creating backup..."
	@tar -czf "luminote-backup-$(shell date +%Y%m%d-%H%M%S).tar.gz" \
	--exclude="*.tar.gz" \
		--exclude=".git" \
	--exclude=".venv" \
		--exclude="venv" \
		--exclude="env" \
		--exclude="__pycache__" \
		--exclude="*.pyc" \
		--exclude="*.pyo" \
		--exclude="*.log" \
		--exclude="server.log" \
		.
	@echo "Backup created!"

# Security check
.PHONY: security-check
security-check:
	@echo "Running security checks..."
	@pip install bandit safety
	@bandit -r . -x .git,venv,.venv,env,__pycache__,*.pyc,*.pyo
	@safety check
	@echo "Security checks completed!"

# Performance test
.PHONY: performance-test
performance-test:
	@echo "Running performance tests..."
	@ab -n 100 -c 10 https://localhost:$(PORT)/health
	@echo "Performance test completed!"
