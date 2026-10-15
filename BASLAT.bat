@echo off
chcp 65001 >nul
title Restoran Admin & Mutfak Paneli (Port 5439) + WhatsApp Servisi
cd /d "%~dp0"

echo ==================================================================
echo   RESTORAN SIPARIS VE YONETIM SISTEMI BASLATILIYOR (PORT 5439)
echo ==================================================================
echo.

node baslatici.mjs

pause
