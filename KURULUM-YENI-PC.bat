@echo off
chcp 65001 >nul
title YENI BILGISAYAR / YENI FIRMA ILK KURULUM SIHIRBAZI
cd /d "%~dp0"

echo ==================================================================
echo   RESTORAN SIPARIS SISTEMI - YENI PC ILK KURULUM SIHIRBAZI
echo ==================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Bu bilgisayarda Node.js kurulu degil!
    echo Lutfen once https://nodejs.org adresinden Node.js v22 LTS surumunu kurun.
    pause
    exit /b 1
)

echo [1/3] Node.js surumu kontrol ediliyor...
node -v

echo.
echo [2/3] Gerekli paketler yukleniyor (npm install)...
call npm install

echo.
echo [3/3] Veri klasoru hazirlaniyor...
if not exist "data" mkdir data

echo.
echo ==================================================================
echo   KURULUM TAMAMLANDI!
echo   Simdi "BASLAT.bat" dosyasina cift tiklayarak sistemi acabilirsiniz.
echo   Acilan terminalde WhatsApp QR kodunu okutun ve
echo   http://localhost:5439/admin adresinden firma ayarlarini yapin.
echo ==================================================================
pause
