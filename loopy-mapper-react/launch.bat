@echo off
REM ================================================================
REM  Loopy Mapper — Windows Launch Script
REM  Usage: launch.bat             → Launch both frontend + backend
REM         launch.bat frontend    → Launch frontend only
REM         launch.bat backend     → Launch backend only
REM         launch.bat help        → Show this help
REM ================================================================

setlocal enabledelayedexpansion
title Loopy Mapper

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

set FRONTEND_PORT=5173
set BACKEND_PORT=8766
set VENV_DIR=backend\.venv

REM ── Colors ──────────────────────────────────────────────────────
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_RESET=%ESC%[0m"
set "C_RED=%ESC%[91m"
set "C_GREEN=%ESC%[92m"
set "C_YELLOW=%ESC%[93m"
set "C_CYAN=%ESC%[96m"
set "C_BOLD=%ESC%[1m"

REM ── Header ──────────────────────────────────────────────────────
echo %C_CYAN%%C_BOLD%================================================%C_RESET%
echo %C_CYAN%%C_BOLD%  Loopy Mapper — Launch Script%C_RESET%
echo %C_CYAN%%C_BOLD%================================================%C_RESET%
echo.

REM ── Help ────────────────────────────────────────────────────────
if /i "%~1"=="help" (
    echo %C_CYAN%Usage:%C_RESET%
    echo   launch.bat            Launch both frontend + backend
    echo   launch.bat frontend   Launch frontend only ^(port %FRONTEND_PORT%^)
    echo   launch.bat backend    Launch backend only ^(port %BACKEND_PORT%^)
    echo   launch.bat help       Show this help
    echo.
    goto :eof
)

REM ── Pre-flight checks ───────────────────────────────────────────
call :check_cmd node "Node.js" || goto :eof
call :check_cmd npm "npm" || goto :eof

REM ── Choose what to launch ───────────────────────────────────────
set LAUNCH_FRONTEND=1
set LAUNCH_BACKEND=1
if /i "%~1"=="frontend" set LAUNCH_BACKEND=0
if /i "%~1"=="backend" set LAUNCH_FRONTEND=0

REM ════════════════════════════════════════════════════════════════
REM  BACKEND
REM ════════════════════════════════════════════════════════════════
if %LAUNCH_BACKEND%==0 goto :frontend

call :check_cmd python "Python 3" || goto :frontend

REM Python version check
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo %C_GREEN%[python] Found Python %PY_VER%%C_RESET%

REM ── Virtual environment ─────────────────────────────────────────
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo %C_YELLOW%[venv] Creating virtual environment...%C_RESET%
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo %C_RED%[venv] Failed to create virtual environment.%C_RESET%
        echo        Try: pip install virtualenv
        goto :frontend
    )
)
echo %C_GREEN%[venv] Using: %VENV_DIR%%C_RESET%

REM ── Install dependencies ────────────────────────────────────────
echo %C_YELLOW%[pip] Installing backend dependencies...%C_RESET%
call "%VENV_DIR%\Scripts\python.exe" -m pip install -q -r backend\requirements.txt
if errorlevel 1 (
    echo %C_RED%[pip] Failed to install dependencies. Try manual install:%C_RESET%
    echo        %VENV_DIR%\Scripts\python.exe -m pip install -r backend\requirements.txt
    goto :frontend
)
echo %C_GREEN%[pip] Dependencies ready.%C_RESET%

REM ── Port check ──────────────────────────────────────────────────
call :check_port %BACKEND_PORT%
if !PORT_FREE!==0 (
    echo %C_RED%[ERROR] Port %BACKEND_PORT% is already in use.%C_RESET%
    echo        Close the process using that port or change BACKEND_PORT.
    goto :frontend
)

REM ── Start backend ───────────────────────────────────────────────
echo %C_CYAN%[backend] Starting FastAPI server on port %BACKEND_PORT%...%C_RESET%
start "Loopy Mapper — Backend" cmd /c ^""%VENV_DIR%\Scripts\python.exe" -m uvicorn backend.main:app --reload --port %BACKEND_PORT% ^& pause^"

REM Wait for backend to be ready
echo %C_YELLOW%[backend] Waiting for server to be ready...%C_RESET%
call :wait_for_url "http://127.0.0.1:%BACKEND_PORT%/api/health" 30
if !URL_READY!==1 (
    echo %C_GREEN%[backend] Server is ready!%C_RESET%
) else (
    echo %C_RED%[backend] Server did not start within timeout.%C_RESET%
    echo        Check the backend window for errors.
)

REM ════════════════════════════════════════════════════════════════
REM  FRONTEND
REM ════════════════════════════════════════════════════════════════
:frontend
if %LAUNCH_FRONTEND%==0 goto :done

REM ── Install npm dependencies ────────────────────────────────────
if not exist "node_modules" (
    echo %C_YELLOW%[npm] Installing frontend dependencies...%C_RESET%
    call npm install
    if errorlevel 1 (
        echo %C_RED%[npm] Failed to install dependencies.%C_RESET%
        goto :done
    )
) else (
    echo %C_GREEN%[npm] node_modules exists — skipping install.%C_RESET%
    echo %C_YELLOW%[npm] Run 'npm install' manually if packages are outdated.%C_RESET%
)

REM ── Port check ──────────────────────────────────────────────────
call :check_port %FRONTEND_PORT%
if !PORT_FREE!==0 (
    echo %C_RED%[ERROR] Port %FRONTEND_PORT% is already in use.%C_RESET%
    echo        Close the process using that port or change FRONTEND_PORT.
    goto :done
)

REM ── Start frontend ──────────────────────────────────────────────
echo %C_CYAN%[frontend] Starting Vite dev server on port %FRONTEND_PORT%...%C_RESET%
start "Loopy Mapper — Frontend" cmd /c "npm run dev & pause"

REM Wait for frontend to be ready
echo %C_YELLOW%[frontend] Waiting for dev server to be ready...%C_RESET%
call :wait_for_url "http://127.0.0.1:%FRONTEND_PORT%" 30
if !URL_READY!==1 (
    echo %C_GREEN%[frontend] Dev server is ready!%C_RESET%
)

REM ════════════════════════════════════════════════════════════════
REM  DONE
REM ════════════════════════════════════════════════════════════════
:done
echo.
echo %C_CYAN%%C_BOLD%================================================%C_RESET%
echo %C_GREEN%%C_BOLD%  Loopy Mapper is running!%C_RESET%
if %LAUNCH_FRONTEND%==1 echo %C_GREEN%  Frontend:  http://localhost:%FRONTEND_PORT%/%C_RESET%
if %LAUNCH_BACKEND%==1 echo %C_GREEN%  Backend:   http://localhost:%BACKEND_PORT%/%C_RESET%
echo %C_CYAN%%C_BOLD%================================================%C_RESET%
echo.
echo %C_YELLOW%Press any key in the spawned terminal windows to stop.%C_RESET%

goto :eof

REM ════════════════════════════════════════════════════════════════
REM  SUBROUTINES
REM ════════════════════════════════════════════════════════════════

REM ── check_cmd ───────────────────────────────────────────────────
:check_cmd
where %~1 >nul 2>&1
if errorlevel 1 (
    echo %C_RED%[ERROR] %~1 not found. Please install %~2 first.%C_RESET%
    exit /b 1
)
exit /b 0

REM ── check_port ──────────────────────────────────────────────────
:check_port
set PORT_FREE=1
netstat -ano 2>nul | findstr ":%~1 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    set PORT_FREE=0
)
exit /b 0

REM ── wait_for_url ────────────────────────────────────────────────
:wait_for_url
set URL_READY=0
set MAX_WAIT=%~2
set /a COUNT=0

:wait_loop
if %COUNT% geq %MAX_WAIT% exit /b 0

timeout /t 1 /nobreak >nul
set /a COUNT+=1

curl -s -o nul -w "%%{http_code}" "%~1" 2>nul | findstr /r "^2[0-9][0-9]$" >nul
if errorlevel 1 goto :wait_loop

set URL_READY=1
exit /b 0