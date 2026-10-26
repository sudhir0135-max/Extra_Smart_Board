@echo off
title ExtraPadhai Dev Server
cd /d "%~dp0"
echo Starting local dev server at http://localhost:3000 ...
call npm run dev
pause
