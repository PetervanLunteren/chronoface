.PHONY: venv models backend frontend dev test lint build clean

VENV?=.venv
PYTHON?=python3
BACKEND_APP=backend.app:app
FRONTEND_DIR=frontend

venv:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install -e .[dev]

models:
	$(VENV)/bin/python backend/scripts/fetch_models.py

backend:
	$(VENV)/bin/uvicorn $(BACKEND_APP) --reload --host 127.0.0.1 --port 8080

frontend:
	cd $(FRONTEND_DIR) && npm install && npm run dev

dev:
	$(VENV)/bin/uvicorn $(BACKEND_APP) --reload --host 127.0.0.1 --port 8080 & \
	cd $(FRONTEND_DIR) && npm install && npm run dev

lint:
	$(VENV)/bin/ruff check backend
	$(VENV)/bin/black --check backend
	$(VENV)/bin/mypy backend
	cd $(FRONTEND_DIR) && npm run lint

build:
	cd $(FRONTEND_DIR) && npm install && npm run build
	rm -rf backend/static/frontend
	mkdir -p backend/static/frontend
	cp -r frontend/dist/* backend/static/frontend/
	$(VENV)/bin/python backend/scripts/fetch_models.py --check

clean:
	rm -rf $(VENV) node_modules $(FRONTEND_DIR)/node_modules dist $(FRONTEND_DIR)/dist

pytest = $(VENV)/bin/pytest
vitest = cd $(FRONTEND_DIR) && npm run test --

test:
	$(pytest)
	$(vitest)
