#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 -c "import bottle" 2>/dev/null || pip install -r requirements.txt
python3 app.py
