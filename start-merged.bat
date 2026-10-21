@echo off
setlocal EnableDelayedExpansion

set ROOT_DIR=%~dp0
set AGRI_DIR=%ROOT_DIR%agri\
set FRONTEND_DIR=%ROOT_DIR%frontend\
set BACKEND_URL=http://localhost:8000
set FRONTEND_URL=http://localhost:5173
set HEALTH_URL=%BACKEND_URL%/api/v1/health

set BACKEND_PID=
set FRONTEND_PID=

:: Check Python
where python >nul 2>&1 || (
    echo ERROR: python is not installed or not on PATH.^
)
exit /b 1
)
where py >nul 2>&1 || (
    echo ERROR: python (py) is not installed or not on PATH.^
)
exit /b 1
)

:: Check uvicorn and fastapi import
cd /d "%AGRI_DIR%"
python -c "import uvicorn, fastapi" >nul 2>&1 || (
    echo ERROR: uvicorn or fastapi not installed. Run: pip install -r agri/requirements.txt
    exit /b 1
)
cd /d "%ROOT_DIR%"

:: Start backend
echo Starting FastAPI backend on port 8000...
start "" /b "cmd" /c "cd /d ""%AGRI_DIR%"" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > ""%ROOT_DIR%.merged-backend.log"" 2>&1"
set BACKEND_PID=!ERRORLEVEL!

:: Start frontend
echo Starting frontend static server on port 5173...
start "" /b "cmd" /c "cd /d ""%FRONTEND_DIR%"" && python -m http.server 5173 > ""%ROOT_DIR%.merged-frontend.log"" 2>&1"
set FRONTEND_PID=!ERRORLEVEL!

:: Wait for readiness (poll up to 60 seconds)
echo Waiting for services to be ready...
set READY=0
for /L %%i in (1,1,60) do (
    curl -sf %HEALTH_URL% >nul 2>&1 && set /a READY+=1
    curl -sf %FRONTEND_URL%/ >nul 2>&1 && set /a READY+=1
    if !READY! geq 2 goto :ready
    timeout /t 1 >nul
)

echo ERROR: Services did not become ready. Check logs:^
echo   %ROOT_DIR%.merged-backend.log^
echo   %ROOT_DIR%.merged-frontend.log
goto :cleanup

:ready
echo.
echo ============= Merged deployment running =============
echo Frontend : %FRONTEND_URL%
echo API      : %BACKEND_URL%
echo Docs     : %BACKEND_URL%/docs
echo.
echo Press Ctrl+C to stop.
timeout /t -1 >nul

:cleanup
if defined BACKEND_PID (
    taskkill /PID %BACKEND_PID% /F >nul 2>&1
)
if defined FRONTEND_PID (
    taskkill /PID %FRONTEND_PID% /F >nul 2>&1
)
endlocal
