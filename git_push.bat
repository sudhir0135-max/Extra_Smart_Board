@echo off
title ExtraPadhai Git Commit and Push
cd /d "%~dp0"
set "LOG=%~dp0git_push.log"
echo Started %DATE% %TIME% > "%LOG%"
git add -A >> "%LOG%" 2>&1
git commit -F ".git\COMMIT_MSG_NEXT" >> "%LOG%" 2>&1
echo COMMIT_EXIT=%ERRORLEVEL% >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
echo PUSH_EXIT=%ERRORLEVEL% >> "%LOG%"
git log --oneline -3 >> "%LOG%" 2>&1
git status --short >> "%LOG%" 2>&1
echo GIT_DONE >> "%LOG%"
echo Done. See git_push.log
pause
