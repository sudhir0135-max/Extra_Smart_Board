@echo off
set "JAVA_HOME=C:\jdk21"
set "ANDROID_SDK_ROOT=C:\Android\sdk"
set "PATH=%JAVA_HOME%\bin;C:\Android\sdk\platform-tools;%PATH%"

echo ========================================
echo   ExtraPadhai Android APK Build Pipeline
echo ========================================
echo Using Java:
"%JAVA_HOME%\bin\java.exe" -version
echo.

cd /d "C:\Single Screen"

echo [1/4] Building production web assets...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Error: npm run build failed!
  exit /b %ERRORLEVEL%
)

echo [2/4] Syncing web assets to Capacitor Android project...
call npx cap copy android
if %ERRORLEVEL% neq 0 (
  echo Error: npx cap copy android failed!
  exit /b %ERRORLEVEL%
)

:: Prevent recursive APK bloat inside assets
if exist "android\app\src\main\assets\public\*.apk" del /q "android\app\src\main\assets\public\*.apk"

echo [3/4] Assembling Android Debug APK via Gradle...
cd /d "C:\Single Screen\android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 (
  echo Error: Gradle build failed!
  exit /b %ERRORLEVEL%
)

cd /d "C:\Single Screen"
echo [4/4] Copying output APK to release targets...
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "ExtraPadhai.apk"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "releases\ExtraPadhai_v5.0.apk"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "dist\ExtraPadhai.apk"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "public\ExtraPadhai.apk"

echo.
echo ========================================
echo   APK Build Finished Successfully!
echo   Outputs:
echo   - C:\Single Screen\ExtraPadhai.apk
echo   - C:\Single Screen\releases\ExtraPadhai_v5.0.apk
echo   - C:\Single Screen\dist\ExtraPadhai.apk
echo   - C:\Single Screen\public\ExtraPadhai.apk
echo ========================================

