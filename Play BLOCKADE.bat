@echo off
rem Starts BLOCKADE on a small local web server (needed for your sound-effect files
rem and accounts) and opens it in your browser. Close this window to stop the server.
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 1 >nul & start http://localhost:8771/"
  python -m http.server 8771 --bind 127.0.0.1
) else (
  echo Python not found: opening the game straight from disk instead.
  start "" "%~dp0index.html"
)
