@echo off
rem Starts a local server for the app and opens it. Needs Python (python.org) or Node.
cd /d "%~dp0"
start "" http://localhost:8000
where python >nul 2>nul && (python -m http.server 8000 & goto :eof)
where py >nul 2>nul && (py -m http.server 8000 & goto :eof)
npx --yes serve -l 8000 .
