@echo off
setlocal
:: ---- Locate Java (JDK 21 / Android Studio bundled JBR) ----
set "JAVA_HOME="
if exist "C:\jdk21\bin\java.exe" set "JAVA_HOME=C:\jdk21"
if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not defined JAVA_HOME (
  echo Error: No JDK found. Install Android Studio or put JDK 21 in C:\jdk21.
  exit /b 1
)

:: ---- Locate Android SDK ----
set "ANDROID_SDK_ROOT="
if exist "C:\Android\sdk\platform-tools" set "ANDROID_SDK_ROOT=C:\Android\sdk"
if not defined ANDROID_SDK_ROOT if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools" set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
if not defined ANDROID_SDK_ROOT if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
if not defined ANDROID_SDK_ROOT (
  echo Error: Android SDK not found.
  exit /b 1
)
set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_SDK_ROOT%\platform-tools;%PATH%"

:: Project root = folder containing this script (works from any location)
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ========================================
echo   ExtraPadhai Android APK Build Pipeline
echo ========================================
echo Project : %ROOT%
echo Java    : %JAVA_HOME%
echo SDK     : %ANDROID_SDK_ROOT%
"%JAVA_HOME%\bin\java.exe" -version
echo.

cd /d "%ROOT%"

:: Point Gradle at this machine's SDK (local.properties is machine-specific and not committed)
set "SDK_FWD=%ANDROID_SDK_ROOT:\=/%"
> "android\local.properties" echo sdk.dir=%SDK_FWD%

echo [1/4] Building production web assets...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Error: npm run build failed!
  exit /b 1
)

echo [2/4] Syncing web assets to Capacitor Android project...
call npx cap copy android
if %ERRORLEVEL% neq 0 (
  echo Error: npx cap copy android failed!
  exit /b 1
)

:: Prevent recursive APK bloat inside assets
if exist "android\app\src\main\assets\public\*.apk" del /q "android\app\src\main\assets\public\*.apk"

echo [3/4] Assembling Android Debug APK via Gradle...
cd /d "%ROOT%\android"
set "JAVA_FWD=%JAVA_HOME:\=/%"
call gradlew.bat assembleDebug "-Dorg.gradle.java.home=%JAVA_FWD%"
if %ERRORLEVEL% neq 0 (
  echo Error: Gradle build failed!
  cd /d "%ROOT%"
  exit /b 1
)

cd /d "%ROOT%"
echo [4/4] Copying output APK to release targets...
if not exist "releases" mkdir "releases"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "ExtraPadhai.apk"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "releases\ExtraPadhai_v5.0.apk"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "dist\ExtraPadhai.apk"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "public\ExtraPadhai.apk"

echo.
echo ========================================
echo   APK Build Finished Successfully!
echo   Outputs:
echo   - %ROOT%\ExtraPadhai.apk
echo   - %ROOT%\releases\ExtraPadhai_v5.0.apk
echo   - %ROOT%\dist\ExtraPadhai.apk
echo   - %ROOT%\public\ExtraPadhai.apk
echo ========================================
endlocal
exit /b 0
