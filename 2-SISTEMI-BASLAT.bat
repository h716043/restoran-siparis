@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="--console" (
    title 2 - Restoran Admin, Mutfak, Garson, Kurye ve WhatsApp Sistemi ^(Port 5439^)
    node baslatici.mjs
    pause
    exit /b 0
)

start "" wscript.exe "%~dp0ARKAPLANDA-BASLAT.vbs" %*
exit /b 0
