@echo off
setlocal

:: ====================================================================================================
:: CONFIGURATION
:: ====================================================================================================
set "NODE_MSI=node-v20.15.1-x64.msi"
set "SCRIPT_DIR=%~dp0"
set "APP_DIR=C:\Launcher"
set "APP_FILE=launcher.js"

echo Step 1: Checking for Node.js installation...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Proceeding with installation.

    if not exist "%SCRIPT_DIR%\%NODE_MSI%" (
        echo ERROR: Installer "%SCRIPT_DIR%\%NODE_MSI%" not found.
        pause
        exit /b 1
    )

    msiexec /i "%SCRIPT_DIR%\%NODE_MSI%" /qn /norestart
    echo Node.js installed.
)

echo.
echo Step 2: Changing directory to %APP_DIR%
cd /d "%APP_DIR%" || exit /b 1

echo Step 3: Running npm install...
CALL npm install || exit /b 1

:: ====================================================================================================
:: CLEAN EXISTING NODE PROCESSES (ONCE)
:: ====================================================================================================
echo.
echo Step 4: Closing existing Node processes (once)...
taskkill /F /IM node.exe >nul 2>nul
timeout /t 2 >nul

:: ====================================================================================================
:: NODE WATCH LOOP
:: ====================================================================================================
echo Step 5: Starting launcher.js with auto-restart...

:START_NODE
echo [%DATE% %TIME%] Starting Node...
node "%APP_FILE%"

echo [%DATE% %TIME%] Node exited with code %ERRORLEVEL%
echo Restarting in 2 seconds...
timeout /t 2 >nul
goto START_NODE