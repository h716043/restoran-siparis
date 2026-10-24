Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Tek ornek (Single Instance) kontrolu
$mutexName = "Global\RestoranPosSunucuDurumGostergesi"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

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

# WPF XAML: Gercek yari-seffaf cam (frosted glass / translucent) gorunumu ve yuvarlatilmis koseler
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Restoran Sunucu Durumu"
        Width="300" Height="74"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        Topmost="True"
        ShowInTaskbar="False"
        ResizeMode="NoResize">
    <Border x:Name="MainBorder"
            CornerRadius="14"
            Margin="4"
            Background="#78FFFFFF"
            BorderBrush="#B8FFFFFF"
            BorderThickness="1.2">
        <Border.Effect>
            <DropShadowEffect BlurRadius="10" ShadowDepth="2" Opacity="0.22" Color="#000000"/>
        </Border.Effect>
        <Grid Margin="12,7,10,8">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
            </Grid.RowDefinitions>

            <!-- Ust Satir: Canli LED Isigi + Durum Yazi + Kucultme Butonu -->
            <Grid Grid.Row="0" Margin="0,0,0,5">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>

                <Ellipse x:Name="StatusDot" Grid.Column="0" Width="11" Height="11"
                         Fill="#10B981" Stroke="#FFFFFF" StrokeThickness="1.5"
                         VerticalAlignment="Center" Margin="0,0,7,0">
                    <Ellipse.Effect>
                        <DropShadowEffect x:Name="DotGlow" BlurRadius="6" ShadowDepth="0" Color="#10B981" Opacity="0.8"/>
                    </Ellipse.Effect>
                </Ellipse>

                <TextBlock x:Name="LblTitle" Grid.Column="1"
                           Text="SUNUCU KONTROL EDİLİYOR..."
                           FontFamily="Segoe UI" FontSize="11.5" FontWeight="Bold"
                           Foreground="#0F172A" VerticalAlignment="Center"/>

                <Button x:Name="BtnHide" Grid.Column="2" Content="—"
                        Width="22" Height="18"
                        FontFamily="Segoe UI" FontSize="11" FontWeight="Bold"
                        Foreground="#334155" Background="#45FFFFFF"
                        BorderBrush="#80FFFFFF" BorderThickness="1"
                        Cursor="Hand" ToolTip="Saatin yanına (Sistem Tepsisine) küçült">
                    <Button.Resources>
                        <Style TargetType="Border">
                            <Setter Property="CornerRadius" Value="5"/>
                        </Style>
                    </Button.Resources>
                </Button>
            </Grid>

            <!-- Alt Satir: Seffaf Hizli Erisim Butonlari -->
            <Grid Grid.Row="1">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="*"/>
                </Grid.ColumnDefinitions>

                <Button x:Name="BtnAdmin" Grid.Column="0" Content="Yönetim"
                        Height="24" Margin="0,0,5,0"
                        FontFamily="Segoe UI" FontSize="11" FontWeight="SemiBold"
                        Foreground="#0F172A" Background="#68FFFFFF"
                        BorderBrush="#99FFFFFF" BorderThickness="1"
                        Cursor="Hand">
                    <Button.Resources>
                        <Style TargetType="Border">
                            <Setter Property="CornerRadius" Value="6"/>
                        </Style>
                    </Button.Resources>
                </Button>

                <Button x:Name="BtnKitchen" Grid.Column="1" Content="Mutfak POS"
                        Height="24" Margin="2,0,5,0"
                        FontFamily="Segoe UI" FontSize="11" FontWeight="SemiBold"
                        Foreground="#0F172A" Background="#68FFFFFF"
                        BorderBrush="#99FFFFFF" BorderThickness="1"
                        Cursor="Hand">
                    <Button.Resources>
                        <Style TargetType="Border">
                            <Setter Property="CornerRadius" Value="6"/>
                        </Style>
                    </Button.Resources>
                </Button>

                <Button x:Name="BtnToggle" Grid.Column="2" Content="Bekleyin"
                        Height="24" Margin="2,0,0,0"
                        FontFamily="Segoe UI" FontSize="11" FontWeight="Bold"
                        Foreground="#FFFFFF" Background="#CCDC2626"
                        BorderBrush="#99FFFFFF" BorderThickness="1"
                        Cursor="Hand">
                    <Button.Resources>
                        <Style TargetType="Border">
                            <Setter Property="CornerRadius" Value="6"/>
                        </Style>
                    </Button.Resources>
                </Button>
            </Grid>
        </Grid>
    </Border>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$window.Left = $screen.Right - 314
$window.Top  = $screen.Top + 12

$mainBorder = $window.FindName("MainBorder")
$statusDot  = $window.FindName("StatusDot")
$dotGlow    = $window.FindName("DotGlow")
$lblTitle   = $window.FindName("LblTitle")
$btnHide    = $window.FindName("BtnHide")
$btnAdmin   = $window.FindName("BtnAdmin")
$btnKitchen = $window.FindName("BtnKitchen")
$btnToggle  = $window.FindName("BtnToggle")

$brushConverter = New-Object System.Windows.Media.BrushConverter

# Mouse uzerine gelince biraz daha netlessin, cekilince daha seffaf olsun
$window.Add_MouseEnter({
    $mainBorder.Background = $brushConverter.ConvertFromString("#A8FFFFFF")
})
$window.Add_MouseLeave({
    $mainBorder.Background = $brushConverter.ConvertFromString("#72FFFFFF")
})
$mainBorder.Background = $brushConverter.ConvertFromString("#72FFFFFF")

# Sol tik ile istedigin yere surukleme
$window.Add_MouseLeftButtonDown({
    $window.DragMove()
})

$btnHide.Add_Click({
    $window.Hide()
    $notifyIcon.ShowBalloonTip(2000, "Restoran Sunucu Göstergesi", "Durum göstergesi sağ alt saat yanına küçültüldü. Tekrar açmak için simgeye tıklayın.", [System.Windows.Forms.ToolTipIcon]::Info)
})

$btnAdmin.Add_Click({ Start-Process "http://localhost:5439/admin" })
$btnKitchen.Add_Click({ Start-Process "http://localhost:5439/kitchen" })

$script:isServerOnline = $false

$btnToggle.Add_Click({
    if ($script:isServerOnline) {
        $lblTitle.Text = "SUNUCU DURDURULUYOR..."
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#B45309")
        Stop-RestaurantServer
    } else {
        $lblTitle.Text = "SUNUCU BAŞLATILIYOR..."
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#B45309")
        Start-RestaurantServer
    }
})

# Sag alt saat yani (System Tray) simgesi
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $iconGreen
$notifyIcon.Text = "Restoran POS Sunucusu Kontrol Ediliyor..."
$notifyIcon.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$menuStatus = $contextMenu.Items.Add("Durum: Kontrol Ediliyor...")
$menuStatus.Enabled = $false
$contextMenu.Items.Add("-") | Out-Null

$menuShowWidget = $contextMenu.Items.Add("Masaüstü Durum Kutucuğunu Göster / Gizle")
$menuShowWidget.Add_Click({
    if ($window.IsVisible) { $window.Hide() } else { $window.Show(); $window.Activate() }
})

$menuOpenAdmin = $contextMenu.Items.Add("Yönetici (Admin) Panelini Aç")
$menuOpenAdmin.Add_Click({ Start-Process "http://localhost:5439/admin" })

$menuOpenKitchen = $contextMenu.Items.Add("Mutfak & Kasa POS Ekranını Aç")
$menuOpenKitchen.Add_Click({ Start-Process "http://localhost:5439/kitchen" })

$contextMenu.Items.Add("-") | Out-Null

$menuStart = $contextMenu.Items.Add("Sunucuyu Başlat (Gizli Arka Plan)")
$menuStart.Add_Click({ Start-RestaurantServer })

$menuRestart = $contextMenu.Items.Add("Sunucuyu Yeniden Başlat")
$menuRestart.Add_Click({
    Stop-RestaurantServer
    Start-Sleep -Seconds 1
    Start-RestaurantServer
})

$menuStop = $contextMenu.Items.Add("Sunucuyu Durdur")
$menuStop.Add_Click({ Stop-RestaurantServer })

$contextMenu.Items.Add("-") | Out-Null
$menuExit = $contextMenu.Items.Add("Göstergeden Çık")
$menuExit.Add_Click({
    $notifyIcon.Visible = $false
    $window.Close()
})

$notifyIcon.ContextMenuStrip = $contextMenu
$notifyIcon.Add_MouseClick({
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        if ($window.IsVisible) { $window.Activate() } else { $window.Show(); $window.Activate() }
    }
})

function Update-ServerStatusUI {
    $posOpen = Test-PortOpen 5439
    $waOpen  = Test-PortOpen 3001
    $script:isServerOnline = $posOpen

    if ($posOpen) {
        $statusDot.Fill = $brushConverter.ConvertFromString("#10B981")
        $dotGlow.Color  = [System.Windows.Media.Color]::FromRgb(16, 185, 129)
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#065F46")
        $waText = if ($waOpen) { "WA: Açık" } else { "Bulut WA" }
        $lblTitle.Text = "SUNUCU AÇIK (5439 • $waText)"
        $btnToggle.Content = "Durdur"
        $btnToggle.Background = $brushConverter.ConvertFromString("#B8DC2626")
        $notifyIcon.Icon = $iconGreen
        $notifyIcon.Text = "Restoran POS Sunucusu: AÇIK (Port 5439)"
        $menuStatus.Text = "Sunucu AÇIK (Port 5439 Aktif)"
    } else {
        $statusDot.Fill = $brushConverter.ConvertFromString("#EF4444")
        $dotGlow.Color  = [System.Windows.Media.Color]::FromRgb(239, 68, 68)
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#991B1B")
        $lblTitle.Text = "SUNUCU KAPALI (Port 5439)"
        $btnToggle.Content = "Başlat"
        $btnToggle.Background = $brushConverter.ConvertFromString("#B8059669")
        $notifyIcon.Icon = $iconRed
        $notifyIcon.Text = "Restoran POS Sunucusu: KAPALI"
        $menuStatus.Text = "Sunucu KAPALI"
    }
}

$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds(3)
$timer.Add_Tick({ Update-ServerStatusUI })
$timer.Start()

$window.Add_Closed({
    $notifyIcon.Visible = $false
    $timer.Stop()
})

Update-ServerStatusUI
$window.ShowDialog() | Out-Null
