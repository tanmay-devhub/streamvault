@echo off
echo ============================================
echo   StreamVault - Video Streaming App
echo ============================================
echo.

:: Check if .env exists
if not exist "backend\.env" (
    echo [!] backend\.env not found.
    echo     Please copy backend\.env.example to backend\.env
    echo     and fill in your AWS credentials.
    echo.
    pause
    exit /b 1
)

:: Check FFmpeg
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] FFmpeg not found in PATH.
    echo     Install via: winget install ffmpeg
    echo     Then restart this script.
    pause
    exit /b 1
)

echo [OK] FFmpeg found
echo [OK] .env found

echo.
echo Starting backend on http://localhost:5000 ...
start "StreamVault Backend" cmd /k "cd backend && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting frontend on http://localhost:3000 ...
start "StreamVault Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo   Both servers starting...
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo ============================================
