@echo off
chcp 65001 >nul
title Restoran POS & WhatsApp - Arka Plan Servis Kontrol Paneli
color 0B
cd /d "%~dp0"

:MENU
cls
echo ============================================================================
echo   RESTORAN POS ^& WHATSAPP - GIZLI ARKA PLAN SERVIS KONTROL PANELI
echo ============================================================================
echo.

set "POS_DURUM=[KAPALI]"
netstat -ano | findstr ":5439 " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 set "POS_DURUM=[AKTIF - CALISIYOR]"

set "WA_DURUM=[KAPALI]"
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 set "WA_DURUM=[AKTIF - CALISIYOR]"

echo   * Restoran POS ^& Mutfak Sunucusu ^(Port 5439^) : %POS_DURUM%
echo   * Yerel WhatsApp QR Servisi      ^(Port 3001^) : %WA_DURUM%
echo   * 7/24 Bulut WhatsApp Koprusu ^(Render.com^)   : https://restoran-siparis-v55a.onrender.com/
echo.
echo ============================================================================
echo   [1] Arka Plan Servisini Baslat ^(Siyah CMD Cikamadan Gizli Calisir^)
echo   [2] Arka Plan Servisini Yeniden Baslat ^(Durdur + Gizli Baslat^)
echo   [3] Arka Plan Servisini Tamamen Durdur ^(Kapat^)
echo   [4] Yonetici ^(Admin^) Panelini Ac ^(http://localhost:5439/admin^)
echo   [5] Mutfak ^& Kasa POS Ekranini Ac ^(http://localhost:5439/kitchen^)
echo   [6] 7/24 Bulut WhatsApp QR Durum Ekranini Ac ^(Render.com^)
echo   [7] Arka Plan Sistem Kayitlarini ^(data\sistem.log^) Goruntule
echo   [0] Cikis
echo ============================================================================
echo.
set /p SECIM="Seciminiz (0-7): "

if "%SECIM%"=="1" goto BASLAT
if "%SECIM%"=="2" goto YENIDEN_BASLAT
if "%SECIM%"=="3" goto DURDUR
if "%SECIM%"=="4" (
    start "" "http://localhost:5439/admin"
    goto MENU
)
if "%SECIM%"=="5" (
    start "" "http://localhost:5439/kitchen"
    goto MENU
)
if "%SECIM%"=="6" (
    start "" "https://restoran-siparis-v55a.onrender.com/"
    goto MENU
)
if "%SECIM%"=="7" (
    if exist "data\sistem.log" (
        start notepad.exe "data\sistem.log"
    ) else (
        echo Henuz data\sistem.log dosyasi olusmamis.
        timeout /t 2 >nul
    )
    goto MENU
)
if "%SECIM%"=="0" exit /b 0
goto MENU

:BASLAT
echo.
echo [+] Servis gizli arka planda baslatiliyor...
start "" wscript.exe "%~dp0ARKAPLANDA-BASLAT.vbs"
timeout /t 3 >nul
goto MENU

:DURDUR
echo.
echo [-] Port 5439 ve Port 3001 uzerindeki arka plan servisleri durduruluyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5439 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -match 'baslatici\.mjs' -or $_.CommandLine -match 'whatsapp-bridge\.mjs') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>nul
echo [OK] Arka plan servisi durduruldu.
timeout /t 2 >nul
goto MENU

:YENIDEN_BASLAT
echo.
echo [~] Arka plan servisi yeniden baslatiliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5439 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -match 'baslatici\.mjs' -or $_.CommandLine -match 'whatsapp-bridge\.mjs') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>nul
timeout /t 2 >nul
start "" wscript.exe "%~dp0ARKAPLANDA-BASLAT.vbs"
echo [OK] Arka plan servisi gizli modda yeniden baslatildi!
timeout /t 3 >nul
goto MENU
