#!/bin/sh
# Starts a local server for the app. Open http://localhost:8000
cd "$(dirname "$0")" && python3 -m http.server 8000
