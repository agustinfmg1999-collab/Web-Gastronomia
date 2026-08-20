@echo off
echo ===================================
echo   Menu Digital - El Patio
echo ===================================
echo.

:: Leer URL publica del config
set PUBLIC_URL=
for /f "tokens=2 delims=:," %%a in ('findstr "publicUrl" config.json') do (
    set PUBLIC_URL=%%~a
)
set PUBLIC_URL=%PUBLIC_URL: =%
set PUBLIC_URL=%PUBLIC_URL:"=%
set PUBLIC_URL=%PUBLIC_URL:~0,-1%

if "%PUBLIC_URL%"=="" (
    echo [INFO] No hay URL publica configurada.
    echo [INFO] Los QR apuntaran a la red local.
    echo [INFO] Para configurar la URL publica, ve a
    echo        Panel Admin ^> Config ^> URL Publica
    echo.
)

:: Iniciar servidor Node
echo [1/2] Iniciando servidor...
start "Servidor Menu Digital" node server.js

:: Iniciar Cloudflare Tunnel si hay URL publica configurada
if not "%PUBLIC_URL%"=="" (
    echo [2/2] Iniciando Cloudflare Tunnel...
    start "Cloudflare Tunnel" cloudflared tunnel --url http://localhost:3000
    echo.
    echo ===================================
    echo   Servidor: http://localhost:3000
    echo   Publico:  %PUBLIC_URL%
    echo ===================================
) else (
    echo.
    echo ===================================
    echo   Servidor: http://localhost:3000
    echo ===================================
)

echo.
echo Presiona Ctrl+C para detener.
pause >nul
