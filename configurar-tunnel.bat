@echo off
echo ===================================
echo   Configurar Cloudflare Tunnel
echo ===================================
echo.
echo Este script configura un tunel de Cloudflare
echo para que los clientes puedan acceder al menu
echo desde internet via un subdomenio.
echo.
echo REQUISITOS:
echo   1. Tener una cuenta en cloudflare.com
echo   2. Tener un dominio registrado en Cloudflare
echo   3. Tener cloudflared instalado (se instala con instalar.bat)
echo.

set /p TUNNEL_NAME="Nombre del tunel (ej: tunnel-elpatio): "
set /p SUBDOMAIN="Subdomenio (ej: elpatio): "
set /p DOMAIN="Dominio (ej: tuplatillo.com): "

echo.
echo [1/4] Autenticando con Cloudflare...
cloudflared tunnel login
if %errorlevel% neq 0 (
    echo [ERROR] Falló la autenticación.
    pause
    exit /b 1
)

echo [2/4] Creando tunel: %TUNNEL_NAME%...
cloudflared tunnel create %TUNNEL_NAME%
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo crear el tunel.
    pause
    exit /b 1
)

echo [3/4] Configurando DNS: %SUBDOMAIN%.%DOMAIN%...
cloudflared tunnel route dns %TUNNEL_NAME% %SUBDOMAIN%.%DOMAIN%
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo configurar el DNS.
    pause
    exit /b 1
)

echo [4/4] Guardando configuracion...
echo https://%SUBDOMAIN%.%DOMAIN% > public_url.txt
echo.
echo ===================================
echo   Configuracion completada!
echo.
echo   Tunel:    %TUNNEL_NAME%
echo   URL:      https://%SUBDOMAIN%.%DOMAIN%
echo.
echo   Copia esta URL en el Panel Admin:
echo   Config ^> URL Publica
echo ===================================
echo.
pause
