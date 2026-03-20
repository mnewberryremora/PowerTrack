@echo off
setlocal

set APP_DIR=%~dp0
cd /d "%APP_DIR%"

echo [1/3] Starting backend (Docker)...
docker-compose up -d
if errorlevel 1 (
    echo ERROR: docker-compose failed. Is Docker Desktop running?
    pause
    exit /b 1
)

echo [2/3] Waiting for backend to be healthy...
:wait_loop
curl -sf http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto wait_loop
)
echo Backend is ready.

echo [3/3] Starting frontend...
start "Training App - Frontend" cmd /k "cd /d "%APP_DIR%frontend" && npm run dev"

echo.
echo App is running:
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo.
echo The frontend opened in a new window. Close it to stop the dev server.
echo To stop the backend: docker-compose down
pause
