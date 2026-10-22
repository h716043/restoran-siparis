Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Tek ornek (Single Instance) kontrolu - ayni anda iki gosterge acilmasini onler
$mutexName = "Global\RestoranPosSunucuDurumGostergesi"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

[System.Windows.Forms.Application]::EnableVisualStyles()

$workDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workDir

function New-CircleIcon([System.Drawing.Color]$fillColor, [System.Drawing.Color]$borderColor) {
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush($fillColor)
    $pen = New-Object System.Drawing.Pen($borderColor, 1.5)
    $g.FillEllipse($brush, 1, 1, 13, 13)
    $g.DrawEllipse($pen, 1, 1, 13, 13)
    $g.Dispose()
    $brush.Dispose()
    $pen.Dispose()
    return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

$iconGreen = New-CircleIcon ([System.Drawing.Color]::FromArgb(16, 185, 129)) ([System.Drawing.Color]::FromArgb(5, 150, 105))
$iconRed   = New-CircleIcon ([System.Drawing.Color]::FromArgb(239, 68, 68)) ([System.Drawing.Color]::FromArgb(185, 28, 28))

function Test-PortOpen([int]$port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(250, $false)
        if ($wait -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Start-RestaurantServer {
    $vbs = Join-Path $workDir "ARKAPLANDA-BASLAT.vbs"
    if (Test-Path $vbs) {
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`" --no-open" -WorkingDirectory $workDir -WindowStyle Hidden
    }
}

function Stop-RestaurantServer {
    $ports = @(5439, 3001)
    foreach ($p in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 4) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -match 'baslatici\.mjs' -or $_.CommandLine -match 'whatsapp-bridge\.mjs') } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# Masaustu sag ust kose canli durum widget formu
$form = New-Object System.Windows.Forms.Form
$form.Text = "Restoran Sunucu Durumu"
$form.Size = New-Object System.Drawing.Size(296, 64)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form.Location = New-Object System.Drawing.Point(($screen.Right - 310), ($screen.Top + 14))
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$form.Opacity = 0.94

# Sol renk seridi
$statusBar = New-Object System.Windows.Forms.Panel
$statusBar.Size = New-Object System.Drawing.Size(6, 64)
$statusBar.Location = New-Object System.Drawing.Point(0, 0)
$statusBar.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$form.Controls.Add($statusBar)

# Durum basligi
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Location = New-Object System.Drawing.Point(14, 7)
$lblTitle.Size = New-Object System.Drawing.Size(245, 20)
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
$lblTitle.Text = "● SUNUCU KONTROL EDİLİYOR..."
$form.Controls.Add($lblTitle)

# Kucult (Tepsiye gizle) butonu
$btnHide = New-Object System.Windows.Forms.Button
$btnHide.Text = "—"
$btnHide.Location = New-Object System.Drawing.Point(266, 4)
$btnHide.Size = New-Object System.Drawing.Size(24, 20)
$btnHide.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnHide.FlatAppearance.BorderSize = 0
$btnHide.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$btnHide.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$btnHide.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$btnHide.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnHide.Add_Click({
    $form.Hide()
    $notifyIcon.ShowBalloonTip(2000, "Restoran Sunucu Göstergesi", "Durum göstergesi sağ alt saat yanına (Sistem Tepsisi) küçültüldü. Tekrar açmak için simgeye tıklayın.", [System.Windows.Forms.ToolTipIcon]::Info)
})
$form.Controls.Add($btnHide)

# Alt butonlar: Admin | Mutfak | Baslat/Durdur
$btnAdmin = New-Object System.Windows.Forms.Button
$btnAdmin.Text = "⚙️ Admin"
$btnAdmin.Location = New-Object System.Drawing.Point(14, 33)
$btnAdmin.Size = New-Object System.Drawing.Size(82, 24)
$btnAdmin.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnAdmin.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnAdmin.ForeColor = [System.Drawing.Color]::White
$btnAdmin.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$btnAdmin.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$btnAdmin.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnAdmin.Add_Click({ Start-Process "http://localhost:5439/admin" })
$form.Controls.Add($btnAdmin)

$btnKitchen = New-Object System.Windows.Forms.Button
$btnKitchen.Text = "👨‍🍳 Mutfak"
$btnKitchen.Location = New-Object System.Drawing.Point(102, 33)
$btnKitchen.Size = New-Object System.Drawing.Size(86, 24)
$btnKitchen.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnKitchen.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnKitchen.ForeColor = [System.Drawing.Color]::White
$btnKitchen.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$btnKitchen.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$btnKitchen.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnKitchen.Add_Click({ Start-Process "http://localhost:5439/kitchen" })
$form.Controls.Add($btnKitchen)

$btnToggle = New-Object System.Windows.Forms.Button
$btnToggle.Text = "⏳ Bekleyin"
$btnToggle.Location = New-Object System.Drawing.Point(194, 33)
$btnToggle.Size = New-Object System.Drawing.Size(92, 24)
$btnToggle.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnToggle.FlatAppearance.BorderSize = 0
$btnToggle.ForeColor = [System.Drawing.Color]::White
$btnToggle.BackColor = [System.Drawing.Color]::FromArgb(234, 88, 12)
$btnToggle.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$btnToggle.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnToggle)

$script:isServerOnline = $false

$btnToggle.Add_Click({
    if ($script:isServerOnline) {
        $lblTitle.Text = "⏳ SUNUCU DURDURULUYOR..."
        $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(251, 191, 36)
        $form.Refresh()
        Stop-RestaurantServer
    } else {
        $lblTitle.Text = "⏳ SUNUCU BAŞLATILIYOR..."
        $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(251, 191, 36)
        $form.Refresh()
        Start-RestaurantServer
    }
})

# Mouse ile surukleme destegi
$script:dragging = $false
$script:dragCursorPoint = [System.Drawing.Point]::Empty
$script:dragFormPoint = [System.Drawing.Point]::Empty

$mouseDownHandler = {
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $script:dragging = $true
        $script:dragCursorPoint = [System.Windows.Forms.Cursor]::Position
        $script:dragFormPoint = $form.Location
    }
}
$mouseMoveHandler = {
    if ($script:dragging) {
        $diff = [System.Drawing.Point]::Subtract([System.Windows.Forms.Cursor]::Position, [System.Drawing.Size]$script:dragCursorPoint)
        $form.Location = [System.Drawing.Point]::Add($script:dragFormPoint, [System.Drawing.Size]$diff)
    }
}
$mouseUpHandler = { $script:dragging = $false }

$form.Add_MouseDown($mouseDownHandler)
$form.Add_MouseMove($mouseMoveHandler)
$form.Add_MouseUp($mouseUpHandler)
$lblTitle.Add_MouseDown($mouseDownHandler)
$lblTitle.Add_MouseMove($mouseMoveHandler)
$lblTitle.Add_MouseUp($mouseUpHandler)

# Sag alt saat yani (System Tray) simgesi ve sag tik menusu
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $iconGreen
$notifyIcon.Text = "Restoran POS Sunucusu Kontrol Ediliyor..."
$notifyIcon.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$menuStatus = $contextMenu.Items.Add("Durum: Kontrol Ediliyor...")
$menuStatus.Enabled = $false
$contextMenu.Items.Add("-") | Out-Null

$menuShowWidget = $contextMenu.Items.Add("📌 Masaüstü Durum Kutucuğunu Göster / Gizle")
$menuShowWidget.Add_Click({
    if ($form.Visible) { $form.Hide() } else { $form.Show(); $form.BringToFront() }
})

$menuOpenAdmin = $contextMenu.Items.Add("⚙️ Yönetici (Admin) Panelini Aç")
$menuOpenAdmin.Add_Click({ Start-Process "http://localhost:5439/admin" })

$menuOpenKitchen = $contextMenu.Items.Add("👨‍🍳 Mutfak & Kasa POS Ekranını Aç")
$menuOpenKitchen.Add_Click({ Start-Process "http://localhost:5439/kitchen" })

$contextMenu.Items.Add("-") | Out-Null

$menuStart = $contextMenu.Items.Add("▶ Sunucuyu Başlat (Gizli Arka Plan)")
$menuStart.Add_Click({ Start-RestaurantServer })

$menuRestart = $contextMenu.Items.Add("🔄 Sunucuyu Yeniden Başlat")
$menuRestart.Add_Click({
    Stop-RestaurantServer
    Start-Sleep -Seconds 1
    Start-RestaurantServer
})

$menuStop = $contextMenu.Items.Add("🛑 Sunucuyu Durdur")
$menuStop.Add_Click({ Stop-RestaurantServer })

$contextMenu.Items.Add("-") | Out-Null
$menuExit = $contextMenu.Items.Add("❌ Göstergeden Çık")
$menuExit.Add_Click({
    $notifyIcon.Visible = $false
    $form.Close()
    [System.Windows.Forms.Application]::Exit()
})

$notifyIcon.ContextMenuStrip = $contextMenu
$notifyIcon.Add_MouseClick({
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        if ($form.Visible) { $form.Activate() } else { $form.Show(); $form.Activate() }
    }
})

function Update-ServerStatusUI {
    $posOpen = Test-PortOpen 5439
    $waOpen  = Test-PortOpen 3001
    $script:isServerOnline = $posOpen

    if ($posOpen) {
        $statusBar.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
        $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
        $waText = if ($waOpen) { "WA: Açık" } else { "Bulut WA" }
        $lblTitle.Text = "🟢 SUNUCU AÇIK (5439 • $waText)"
        $btnToggle.Text = "🛑 Durdur"
        $btnToggle.BackColor = [System.Drawing.Color]::FromArgb(185, 28, 28)
        $notifyIcon.Icon = $iconGreen
        $notifyIcon.Text = "Restoran POS Sunucusu: AÇIK (Port 5439)"
        $menuStatus.Text = "🟢 Sunucu AÇIK (Port 5439 Aktif)"
    } else {
        $statusBar.BackColor = [System.Drawing.Color]::FromArgb(239, 68, 68)
        $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(252, 165, 165)
        $lblTitle.Text = "🔴 SUNUCU KAPALI (Port 5439)"
        $btnToggle.Text = "▶ Başlat"
        $btnToggle.BackColor = [System.Drawing.Color]::FromArgb(5, 150, 105)
        $notifyIcon.Icon = $iconRed
        $notifyIcon.Text = "Restoran POS Sunucusu: KAPALI"
        $menuStatus.Text = "🔴 Sunucu KAPALI"
    }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({ Update-ServerStatusUI })
$timer.Start()

Update-ServerStatusUI
[System.Windows.Forms.Application]::Run($form)
