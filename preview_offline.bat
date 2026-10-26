@echo off
title ExtraPadhai Offline Preview
cd /d "%~dp0"
echo Building production version...
call npm run build
if errorlevel 1 goto :fail
echo.
echo Starting production preview at http://localhost:4173 ...
call npx vite preview --port 4173 --strictPort
goto :end
:fail
echo BUILD FAILED
:end
pause
