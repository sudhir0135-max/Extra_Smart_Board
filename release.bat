@echo off
setlocal
title ExtraPadhai Release (APK + Firebase + Git)
cd /d "%~dp0"
set "LOG=%~dp0release.log"
echo Release started %DATE% %TIME% > "%LOG%"

echo ==== [1/3] Build APK (includes web build) ==== >> "%LOG%"
echo [1/3] Building APK... (this can take several minutes)
call "%~dp0build_apk.bat" >> "%LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
  echo RESULT_APK=FAILED >> "%LOG%"
  echo APK build FAILED - nothing deployed or committed. See release.log
  goto :done
)
echo RESULT_APK=OK >> "%LOG%"

echo ==== [2/3] Firebase Hosting deploy ==== >> "%LOG%"
echo [2/3] Deploying to Firebase Hosting...
cd /d "%~dp0"
where firebase >nul 2>&1
if %ERRORLEVEL% equ 0 (
  call firebase deploy --only hosting --non-interactive >> "%LOG%" 2>&1
) else (
  call npx --yes firebase-tools deploy --only hosting --non-interactive >> "%LOG%" 2>&1
)
if %ERRORLEVEL% neq 0 (
  echo RESULT_DEPLOY=FAILED >> "%LOG%"
  echo Firebase deploy FAILED - continuing with git. See release.log
) else (
  echo RESULT_DEPLOY=OK >> "%LOG%"
)

echo ==== [3/3] Git commit and push ==== >> "%LOG%"
echo [3/3] Committing and pushing to git...
cd /d "%~dp0"
git add -A >> "%LOG%" 2>&1
git commit -F ".git\RELEASE_COMMIT_MSG" >> "%LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
  echo RESULT_COMMIT=FAILED >> "%LOG%"
) else (
  echo RESULT_COMMIT=OK >> "%LOG%"
)
git push origin HEAD >> "%LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
  echo RESULT_PUSH=FAILED >> "%LOG%"
) else (
  echo RESULT_PUSH=OK >> "%LOG%"
)
git log --oneline -3 >> "%LOG%" 2>&1

:done
echo Release finished %DATE% %TIME% >> "%LOG%"
echo RELEASE_DONE >> "%LOG%"
echo.
echo Done. See release.log for details.
endlocal
pause
