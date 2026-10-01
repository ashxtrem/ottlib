@echo off
setlocal

rem Run the production server from this repository, regardless of the caller's folder (this script lives in scripts/).
cd /d "%~dp0.."

if not exist "data\logs" mkdir "data\logs"
call npm start >> "data\logs\server-startup.log" 2>&1

