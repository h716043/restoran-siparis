@echo off
chcp 65001 >nul
title YENI BILGISAYAR / YENI FIRMA ILK KURULUM SIHIRBAZI
color 0B
cd /d "%~dp0"

echo ============================================================================
echo   RESTORAN SIPARIS VE POS SISTEMI - YENI PC / YENI FIRMA KURULUM SIHIRBAZI
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [UYARI] Bu bilgisayarda Node.js kurulu degil!
    echo Windows Paket Yoneticisi ^(winget^) ile otomatik Node.js v22 LTS kuruluyor...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [!] Otomatik kurulum tamamlanamadi. Tarayicida Node.js indirme sayfasi aciliyor...
        start https://nodejs.org/
        echo Lutfen indirilen Node.js kurulumunu tamamlayip bu dosyayi tekrar calistirin.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Node.js kuruldu! Lutfen bu pencereyi kapatip KURULUM-YENI-PC.bat dosyasini yeniden acin.
    pause
    exit /b 0
)

echo [1/4] Node.js surumu kontrol ediliyor...
node -v

echo.
echo [2/4] Gerekli sistem paketleri indiriliyor ve kuruluyor ^(npm install^)...
echo       ^(Bu islem internet hiziniza gore 1-2 dakika surebilir, lutfen bekleyin^)
call npm install

echo.
echo [3/4] Veri klasoru ^(data/^) hazirlaniyor...
if not exist "data" mkdir data

echo.
echo [4/4] Masaustune "Restoran POS Baslat" (Gizli Arka Plan) kisayolu olusturuluyor...
set "TARGET_VBS=%~dp0ARKAPLANDA-BASLAT.vbs"
set "WORK_DIR=%~dp0"
for /f "usebackq tokens=*" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP_DIR=%%D"
set "SHORTCUT_PATH=%DESKTOP_DIR%\Restoran POS ve WhatsApp Baslat.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%WORK_DIR%'; $s.WindowStyle = 7; $s.Description = 'Restoran Siparis, Mutfak ve WhatsApp Sistemi (Gizli Arka Plan)'; $s.Save()"

echo.
echo ============================================================================
echo   TEBRIKLER! KURULUM BASARIYLA TAMAMLANDI!
echo   1. Masaustunde olusan "Restoran POS ve WhatsApp Baslat" kisayoluna veya
echo      klasordeki "BASLAT.bat" dosyasina cift tiklayarak sistemi acabilirsiniz.
echo   2. Acilan siyah ekranda cikan WhatsApp QR kodunu telefonunuzdan okutun.
echo   3. Tarayicida acilan http://localhost:5439/admin sayfasindan restoran
echo      adinizi, menunuzu, شifrelerinizi ve Turso bulut ayarlarinizi girin.
echo ============================================================================
pause
