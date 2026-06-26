@echo off
set "JAVA_HOME=C:\jdk21"
set "ANDROID_SDK_ROOT=C:\Android\sdk"
set "PATH=%JAVA_HOME%\bin;C:\Android\sdk\platform-tools;%PATH%"
echo Using Java:
"%JAVA_HOME%\bin\java.exe" -version
echo.
echo Building APK...
cd /d "C:\Single Screen\android"
call gradlew.bat assembleDebug
echo.
echo Build finished with exit code: %ERRORLEVEL%
