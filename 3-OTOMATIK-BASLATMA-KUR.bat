@echo off
chcp 65001 >nul
title 3 - Windows Otomatik Baslatma ve Uyku Modu Engelleme Kurulumu
color 0A
cd /d "%~dp0"

echo ============================================================================
echo   RESTORAN SIPARIS SISTEMI - KASA PC OTOMATIK BASLATMA KURULUMU
echo ============================================================================
echo.

echo [1/2] Windows Uyku Modu (Sleep / Standby) kapatiliyor...
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 60
echo       [OK] Bilgisayar prizdeyken uyku modu tamamen devre disi birakildi!
echo.

echo [2/2] Windows acildiginda Restoran Sisteminin GIZLI ARKA PLANDA baslamasi ayarlaniyor...
set "TARGET_VBS=%~dp0ARKAPLANDA-BASLAT.vbs"
set "WORK_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\Restoran-POS-Baslat.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%WORK_DIR%'; $s.WindowStyle = 7; $s.Description = 'Restoran Siparis ve WhatsApp Sistemi Gizli Arkaplan Baslatici'; $s.Save()"

echo.
echo ============================================================================
echo   TAMAMLANDI! Kasa bilgisayari her acildiginda sistem otomatik baslayacak.
echo ============================================================================
pause
