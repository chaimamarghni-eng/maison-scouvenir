@echo off
cd /d "%~dp0"
echo Demarrage de Maison SCouvenir...
start "" http://localhost:3000
node --no-warnings server.js
pause
