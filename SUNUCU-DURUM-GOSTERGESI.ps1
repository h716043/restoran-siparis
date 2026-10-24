Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Show {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

# Eger arkada kalmis eski bir gosterge sureci varsa kapat ki kullanici tikladiginda her zaman acilsin
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.Name -eq 'powershell.exe' -and $_.CommandLine -match 'SUNUCU-DURUM-GOSTERGESI\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

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

# WPF'in ilk pencereyi SW_HIDE (gizli) acma davranisini tuketmek icin gecici 0x0 pencere
$dummyWin = New-Object System.Windows.Window
$dummyWin.Width = 0
$dummyWin.Height = 0
$dummyWin.WindowStyle = [System.Windows.WindowStyle]::None
$dummyWin.ShowInTaskbar = $false
$dummyWin.AllowsTransparency = $true
$dummyWin.Opacity = 0
$dummyWin.Show()
$dummyWin.Close()

# WPF XAML: Gercek yari-seffaf cam (frosted glass / translucent) gorunumu ve yuvarlatilmis koseler
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Restoran Sunucu Durumu"
        Width="304" Height="76"
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
            BorderBrush="#CCFFFFFF"
            BorderThickness="1.4">
        <Border.Effect>
            <DropShadowEffect BlurRadius="10" ShadowDepth="2" Opacity="0.24" Color="#000000"/>
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
                        <DropShadowEffect x:Name="DotGlow" BlurRadius="6" ShadowDepth="0" Color="#10B981" Opacity="0.85"/>
                    </Ellipse.Effect>
                </Ellipse>

                <TextBlock x:Name="LblTitle" Grid.Column="1"
                           Text="SUNUCU KONTROL ED&#x0130;L&#x0130;YOR..."
                           FontFamily="Segoe UI" FontSize="11.5" FontWeight="Bold"
                           Foreground="#0F172A" VerticalAlignment="Center"/>

                <Button x:Name="BtnHide" Grid.Column="2" Content="&#x2014;"
                        Width="22" Height="18"
                        FontFamily="Segoe UI" FontSize="11" FontWeight="Bold"
                        Foreground="#1E293B" Background="#55FFFFFF"
                        BorderBrush="#99FFFFFF" BorderThickness="1"
                        Cursor="Hand" ToolTip="Saatin yan&#x0131;na (Sistem Tepsisine) k&#x00FC;&#x00E7;&#x00FC;lt">
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

                <Button x:Name="BtnAdmin" Grid.Column="0" Content="Y&#x00F6;netim"
                        Height="24" Margin="0,0,5,0"
                        FontFamily="Segoe UI" FontSize="11" FontWeight="SemiBold"
                        Foreground="#0F172A" Background="#75FFFFFF"
                        BorderBrush="#B0FFFFFF" BorderThickness="1"
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
                        Foreground="#0F172A" Background="#75FFFFFF"
                        BorderBrush="#B0FFFFFF" BorderThickness="1"
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
                        BorderBrush="#B0FFFFFF" BorderThickness="1"
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

# WPF DPI olceklendirmesine (%125, %150, %175) tam uyumlu sag ust kose koordinati
$workArea = [System.Windows.SystemParameters]::WorkArea
$window.Left = $workArea.Right - $window.Width - 14
$window.Top  = $workArea.Top + 12

# Pencere acildiginda SW_HIDE etkisini kesin olarak kaldirip ekranda goster (SW_SHOW = 5)
$window.Add_SourceInitialized({
    $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
    [Win32Show]::ShowWindow($helper.Handle, 5) | Out-Null
    [Win32Show]::SetForegroundWindow($helper.Handle) | Out-Null
})

$window.Add_Loaded({
    $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
    [Win32Show]::ShowWindow($helper.Handle, 5) | Out-Null
    [Win32Show]::SetForegroundWindow($helper.Handle) | Out-Null
    $window.Visibility = [System.Windows.Visibility]::Visible
    $window.Activate() | Out-Null
})

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
    $mainBorder.Background = $brushConverter.ConvertFromString("#B0FFFFFF")
})
$window.Add_MouseLeave({
    $mainBorder.Background = $brushConverter.ConvertFromString("#68FFFFFF")
})
$mainBorder.Background = $brushConverter.ConvertFromString("#68FFFFFF")

# Sol tik ile istedigin yere surukleme
$window.Add_MouseLeftButtonDown({
    $window.DragMove()
})

function TrText([string]$s) {
    return [System.Text.RegularExpressions.Regex]::Unescape($s)
}

$btnHide.Add_Click({
    $window.Hide()
    $notifyIcon.ShowBalloonTip(
        2000,
        (TrText "Restoran Sunucu G\u00F6stergesi"),
        (TrText "Durum g\u00F6stergesi sa\u011F alt saat yan\u0131na k\u00FC\u00E7\u00FClt\u00FCld\u00FC. Tekrar a\u00E7mak i\u00E7in simgeye t\u0131klay\u0131n."),
        [System.Windows.Forms.ToolTipIcon]::Info
    )
})

$btnAdmin.Add_Click({ Start-Process "http://localhost:5439/admin" })
$btnKitchen.Add_Click({ Start-Process "http://localhost:5439/kitchen" })

$script:isServerOnline = $false

$btnToggle.Add_Click({
    if ($script:isServerOnline) {
        $lblTitle.Text = (TrText "SUNUCU DURDURULUYOR...")
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#B45309")
        Stop-RestaurantServer
    } else {
        $lblTitle.Text = (TrText "SUNUCU BA\u015ELATILIYOR...")
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#B45309")
        Start-RestaurantServer
    }
})

# Sag alt saat yani (System Tray) simgesi
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $iconGreen
$notifyIcon.Text = (TrText "Restoran POS Sunucusu Kontrol Ediliyor...")
$notifyIcon.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$menuStatus = $contextMenu.Items.Add((TrText "Durum: Kontrol Ediliyor..."))
$menuStatus.Enabled = $false
$contextMenu.Items.Add("-") | Out-Null

$menuShowWidget = $contextMenu.Items.Add((TrText "Masa\u00FCst\u00FC Durum Kutucu\u011Funu G\u00F6ster / Gizle"))
$menuShowWidget.Add_Click({
    if ($window.IsVisible) {
        $window.Hide()
    } else {
        $window.Show()
        $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
        [Win32Show]::ShowWindow($helper.Handle, 5) | Out-Null
        $window.Activate()
    }
})

$menuOpenAdmin = $contextMenu.Items.Add((TrText "Y\u00F6netici (Admin) Panelini A\u00E7"))
$menuOpenAdmin.Add_Click({ Start-Process "http://localhost:5439/admin" })

$menuOpenKitchen = $contextMenu.Items.Add((TrText "Mutfak && Kasa POS Ekran\u0131n\u0131 A\u00E7"))
$menuOpenKitchen.Add_Click({ Start-Process "http://localhost:5439/kitchen" })

$contextMenu.Items.Add("-") | Out-Null

$menuStart = $contextMenu.Items.Add((TrText "Sunucuyu Ba\u015Flat (Gizli Arka Plan)"))
$menuStart.Add_Click({ Start-RestaurantServer })

$menuRestart = $contextMenu.Items.Add((TrText "Sunucuyu Yeniden Ba\u015Flat"))
$menuRestart.Add_Click({
    Stop-RestaurantServer
    Start-Sleep -Seconds 1
    Start-RestaurantServer
})

$menuStop = $contextMenu.Items.Add((TrText "Sunucuyu Durdur"))
$menuStop.Add_Click({ Stop-RestaurantServer })

$contextMenu.Items.Add("-") | Out-Null
$menuExit = $contextMenu.Items.Add((TrText "G\u00F6stergeden \u00C7\u0131k"))
$menuExit.Add_Click({
    $notifyIcon.Visible = $false
    $timer.Stop()
    $window.Close()
    if ([System.Windows.Application]::Current) {
        [System.Windows.Application]::Current.Shutdown()
    }
})

$notifyIcon.ContextMenuStrip = $contextMenu
$notifyIcon.Add_MouseClick({
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $window.Show()
        $window.WindowState = [System.Windows.WindowState]::Normal
        $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
        [Win32Show]::ShowWindow($helper.Handle, 5) | Out-Null
        [Win32Show]::SetForegroundWindow($helper.Handle) | Out-Null
        $window.Activate() | Out-Null
    }
})

function Update-ServerStatusUI {
    $posOpen = Test-PortOpen 5439
    $waOpen  = Test-PortOpen 3001
    $script:isServerOnline = $posOpen

    if ($posOpen) {
        $statusDot.Fill = $brushConverter.ConvertFromString("#10B981")
        $dotGlow.Color  = [System.Windows.Media.Color]::FromRgb(16, 185, 129)
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#064E3B")
        $waText = if ($waOpen) { (TrText "WA: A\u00E7\u0131k") } else { "Bulut WA" }
        $lblTitle.Text = (TrText "SUNUCU A\u00C7IK (5439 \u2022 $waText)")
        $btnToggle.Content = "Durdur"
        $btnToggle.Background = $brushConverter.ConvertFromString("#BFDC2626")
        $notifyIcon.Icon = $iconGreen
        $notifyIcon.Text = (TrText "Restoran POS Sunucusu: A\u00C7IK (Port 5439)")
        $menuStatus.Text = (TrText "Sunucu A\u00C7IK (Port 5439 Aktif)")
    } else {
        $statusDot.Fill = $brushConverter.ConvertFromString("#EF4444")
        $dotGlow.Color  = [System.Windows.Media.Color]::FromRgb(239, 68, 68)
        $lblTitle.Foreground = $brushConverter.ConvertFromString("#7F1D1D")
        $lblTitle.Text = "SUNUCU KAPALI (Port 5439)"
        $btnToggle.Content = (TrText "Ba\u015Flat")
        $btnToggle.Background = $brushConverter.ConvertFromString("#BF059669")
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
    if ([System.Windows.Application]::Current) {
        [System.Windows.Application]::Current.Shutdown()
    }
})

Update-ServerStatusUI

# ShowDialog() yerine OnExplicitShutdown modunda Application.Run() kullanilir;
# boylece $window.Hide() cagrildiginda arka plan sureci ve saatin yanindaki yesil simge kapanmaz!
$app = [System.Windows.Application]::Current
if (-not $app) {
    $app = New-Object System.Windows.Application
}
$app.ShutdownMode = [System.Windows.ShutdownMode]::OnExplicitShutdown
$window.Show()
$app.Run() | Out-Null
