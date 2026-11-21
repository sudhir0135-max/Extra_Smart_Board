@echo off
setlocal
title ExtraPadhai Deploy (Storage rules)
cd /d "%~dp0"
set "LOG=%~dp0deploy_rules.log"
echo Storage rules deploy started %DATE% %TIME% > "%LOG%"
where firebase >nul 2>&1
if %ERRORLEVEL% equ 0 (
  call firebase deploy --only storage --non-interactive >> "%LOG%" 2>&1
) else (
  call npx --yes firebase-tools deploy --only storage --non-interactive >> "%LOG%" 2>&1
)
if %ERRORLEVEL% neq 0 (
  echo RESULT_RULES=FAILED >> "%LOG%"
) else (
  echo RESULT_RULES=OK >> "%LOG%"
)
echo RULES_DONE >> "%LOG%"
echo Done. See deploy_rules.log
endlocal
pause
