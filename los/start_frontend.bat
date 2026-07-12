@echo off
title LOS Angular Frontend
cd /d "%~dp0frontend"
echo Starting Angular Dev Server on http://localhost:4200 ...
npx ng serve --open
pause
