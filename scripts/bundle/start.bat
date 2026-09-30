@echo off
setlocal
rem Starts OttLib from this folder. Config and data live next to it (config\, data\).
cd /d "%~dp0"

if exist "runtime\node.exe" (
  set "NODE=%~dp0runtime\node.exe"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js 22 or later is required: https://nodejs.org
    pause
    exit /b 1
  )
  set "NODE=node"
  for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set "MAJOR=%%v"
  if %MAJOR% LSS 22 (
    echo OttLib needs Node.js 22 or later.
    pause
    exit /b 1
  )
)

if exist "runtime\ffprobe.exe" set "FFPROBE_PATH=%~dp0runtime\ffprobe.exe"
if not exist "data\logs" mkdir "data\logs"

echo OttLib is starting. Leave this window open; close it to stop the server.
"%NODE%" packages\server\dist\index.js
pause
