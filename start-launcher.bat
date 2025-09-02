@echo off
setlocal

:: ====================================================================================================
:: CONFIGURATION
:: ====================================================================================================
set "NODE_MSI=node-v20.15.1-x64.msi"
:: Replace the version above with the version you downloaded.
:: Example: node-v20.15.1-x64.msi for the 64-bit LTS version.

:: Get the directory where the batch file is located
set "SCRIPT_DIR=%~dp0"

echo Step 1: Checking for Node.js installation...

:: Check if the 'node' command exists
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Proceeding with installation.
    
    echo Step 1.1: Checking for installer file %NODE_MSI%...
    if not exist "%SCRIPT_DIR%\%NODE_MSI%" (
        echo ERROR: The Node.js installer file "%NODE_DIR%\%NODE_MSI%" was not found.
        echo Please download it from https://nodejs.org/en/ and place it in the same directory as this script.
        pause
        exit /b 1
    )

    echo Step 1.2: Running Node.js installer.
    echo This may take a moment.
    
    :: The /qn switch runs the installer in silent mode with no user interaction.
    :: The /norestart switch prevents an automatic reboot.
    msiexec /i "%SCRIPT_DIR%\%NODE_MSI%" /qn /norestart
    
    echo Step 1.3: Installation complete.
    echo Please restart your terminal/command prompt for the changes to take effect.
) else (
    echo Node.js is already installed. Skipping installation.
)

echo.
echo Step 2: Changing directory to C:\Launcher
cd /d C:\Launcher
if %ERRORLEVEL% NEQ 0 (
    echo Failed to change directory to C:\Launcher
    pause
    exit /b 1
)

echo Step 3: Running npm install...
CALL npm install
echo npm install exited with code %ERRORLEVEL%
if %ERRORLEVEL% NEQ 0 (
    echo npm install failed.
    pause
    exit /b 1
)

echo Step 4: Running node launcher.js...
node launcher.js
echo node launcher.js exited with code %ERRORLEVEL%
if %ERRORLEVEL% NEQ 0 (
    echo launcher.js failed to start or crashed.
    pause
    exit /b 1
)

echo Step 5: Script finished.
pause
endlocal