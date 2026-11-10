@echo off
setlocal
rem Checks this OttLib folder: library folders, disk space, ffmpeg, TMDb key, backups, updates.
rem Prints OK / WARN / FAIL per check; the exit code is 1 when any check fails.
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
)

if exist "runtime\ffprobe.exe" set "FFPROBE_PATH=%~dp0runtime\ffprobe.exe"
if exist "runtime\ffmpeg.exe" set "FFMPEG_PATH=%~dp0runtime\ffmpeg.exe"

"%NODE%" packages\server\dist\scripts\doctor.js
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
