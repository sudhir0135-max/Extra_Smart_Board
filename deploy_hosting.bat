@echo off
setlocal
title ExtraPadhai Deploy (Firebase Hosting)
cd /d "%~dp0"
set "LOG=%~dp0deploy.log"
echo Deploy started %DATE% %TIME% > "%LOG%"
echo [1/2] Building web app...
call npm run build >> "%LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
  echo RESULT_BUILD=FAILED >> "%LOG%"
  echo Build FAILED - nothing deployed. See deploy.log
  goto :done
)
echo RESULT_BUILD=OK >> "%LOG%"
:: Keep the APK download available on the website
if exist "ExtraPadhai.apk" copy /y "ExtraPadhai.apk" "dist\ExtraPadhai.apk" >> "%LOG%" 2>&1
echo [2/2] Deploying to Firebase Hosting...
where firebase >nul 2>&1
if %ERRORLEVEL% equ 0 (
  call firebase deploy --only hosting --non-interactive >> "%LOG%" 2>&1
) else (
  call npx --yes firebase-tools deploy --only hosting --non-interactive >> "%LOG%" 2>&1
)
if %ERRORLEVEL% neq 0 (
  echo RESULT_DEPLOY=FAILED >> "%LOG%"
) else (
  echo RESULT_DEPLOY=OK >> "%LOG%"
)
:done
echo DEPLOY_DONE >> "%LOG%"
echo Done. See deploy.log
endlocal
pause
