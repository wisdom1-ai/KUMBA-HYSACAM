@echo off
setlocal
cd /d "%~dp0"
echo Starting HYSACAM Kumba Tracker with report server...
where py >nul 2>nul
if %errorlevel%==0 (
  start "HYSACAM Kumba Tracker Server" /D "%~dp0" cmd /k "py -3 server.py"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "HYSACAM Kumba Tracker Server" /D "%~dp0" cmd /k "python server.py"
  ) else (
    echo Python 3 was not found. Install Python 3, then run this file again.
    pause
    exit /b 1
  )
)
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html"
