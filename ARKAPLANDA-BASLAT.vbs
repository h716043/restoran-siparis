Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

workDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = workDir

If Not fso.FolderExists(workDir & "\data") Then
  On Error Resume Next
  fso.CreateFolder(workDir & "\data")
  On Error GoTo 0
End If

extraArgs = ""
If WScript.Arguments.Count > 0 Then
  For i = 0 To WScript.Arguments.Count - 1
    extraArgs = extraArgs & " " & WScript.Arguments(i)
  Next
End If

' 0 = vbHide: Siyah CMD ekrani cikmadan tamamen gizli (arka planda) baslatir
cmd = "cmd.exe /c ""node baslatici.mjs" & extraArgs & " >> data\sistem.log 2>&1"""
WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
