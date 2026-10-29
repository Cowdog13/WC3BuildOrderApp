@echo off
rem Launches the WC3 build order overlay (installs Electron the first time).
cd /d "%~dp0desktop"
if not exist node_modules (
  echo First run: installing Electron, this takes a minute...
  call npm install
)
call npm start
