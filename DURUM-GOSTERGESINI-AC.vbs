Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

workDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = workDir

psFile = workDir & "\SUNUCU-DURUM-GOSTERGESI.ps1"
If fso.FileExists(psFile) Then
  psCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psFile & """"
  WshShell.Run psCmd, 0, False
End If

Set WshShell = Nothing
Set fso = Nothing
