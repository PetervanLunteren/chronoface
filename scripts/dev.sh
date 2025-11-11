#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d .venv ]]; then
  echo "Creating virtual environment"
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -e .[dev]

pushd backend >/dev/null
uvicorn app:app --reload --host 127.0.0.1 --port 8080 &
BACKEND_PID=$!
popd >/dev/null

pushd frontend >/dev/null
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run dev
popd >/dev/null

kill $BACKEND_PID
