@echo off
setlocal

:: Configuration
set "LAUNCHER_DIR=C:\Launcher"
set "ZIP_URL=https://github.com/saradbsre/Launcher/archive/refs/heads/main.zip"
set "ZIP_PATH=%LAUNCHER_DIR%\launcher.zip"
set "EXTRACTED_SUBDIR=%LAUNCHER_DIR%\Launcher-main"
set "RUNNER_BATCH=start-launcher.bat"

:: 1. Create directory if missing
if not exist "%LAUNCHER_DIR%" (
  echo Creating launcher directory at %LAUNCHER_DIR%...
  mkdir "%LAUNCHER_DIR%"
)

:: 2. Check for key file
if exist "%LAUNCHER_DIR%\launcher.js" (
  echo Launcher files already exist. Skipping download.
  goto run_launcher
)

:: 3. Download ZIP from GitHub
echo Downloading launcher from GitHub...
powershell -Command "try { Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_PATH%' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
  echo  Error: Failed to download launcher files. Check network and URL.
  exit /b 1
)

:: 4. Extract ZIP contents
echo Extracting files...
powershell -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%LAUNCHER_DIR%' -Force"
if errorlevel 1 (
  echo  Error: Extraction failed.
  exit /b 1
)

:: 5. Cleanup ZIP
del "%ZIP_PATH%"

:: 6. Move extracted into root folder
xcopy /E /I /Y "%EXTRACTED_SUBDIR%\*" "%LAUNCHER_DIR%\"
rd /S /Q "%EXTRACTED_SUBDIR%"

:: 7. Launch
:run_launcher
echo Running the launcher...
cd /D "%LAUNCHER_DIR%"
call "%RUNNER_BATCH%"

endlocal
exit /b 0
