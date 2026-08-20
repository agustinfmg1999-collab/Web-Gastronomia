@echo off
echo ===================================
echo   Instalador - Sistema Menu Digital
echo ===================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo desde: https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Falló npm install
    pause
    exit /b 1
)

echo [2/4] Descargando Cloudflare Tunnel...
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -o cloudflared.exe
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo descargar cloudflared
        pause
        exit /b 1
    )
    echo    cloudflared descargado correctamente.
) else (
    echo    cloudflared ya esta instalado.
)

echo [3/4] Creando acceso directo en escritorio...
echo @echo off > "%USERPROFILE%\Desktop\Iniciar Menu Digital.bat"
echo cd /d "%~dp0" >> "%USERPROFILE%\Desktop\Iniciar Menu Digital.bat"
echo call iniciar.bat >> "%USERPROFILE%\Desktop\Iniciar Menu Digital.bat"
echo.
echo [4/4] Instalacion completa!
echo.
echo ===================================
echo   Para iniciar el sistema:
echo   Doble clic en "Iniciar Menu Digital"
echo   en el escritorio.
echo ===================================
echo.
pause
