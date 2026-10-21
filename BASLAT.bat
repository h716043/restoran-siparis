@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="--console" (
    title Restoran Admin ^& Mutfak Paneli ^(Port 5439^) + WhatsApp Servisi
    node baslatici.mjs
    pause
    exit /b 0
)

start "" wscript.exe "%~dp0ARKAPLANDA-BASLAT.vbs" %*
exit /b 0
