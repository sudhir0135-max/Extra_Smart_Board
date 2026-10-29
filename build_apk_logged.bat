@echo off
cd /d "%~dp0"
set "LOG=%~dp0apk.log"
echo APK build started %DATE% %TIME% > "%LOG%"
call "%~dp0build_apk.bat" >> "%LOG%" 2>&1 < nul
if %ERRORLEVEL% neq 0 (echo RESULT_APK=FAILED >> "%LOG%") else (echo RESULT_APK=OK >> "%LOG%")
echo APK_DONE >> "%LOG%"
echo Done. See apk.log
pause
