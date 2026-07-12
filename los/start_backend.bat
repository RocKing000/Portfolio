@echo off
title LOS Backend API
cd /d "%~dp0backend"
echo Starting LOS Flask API on http://localhost:5001 ...
python api.py
pause
