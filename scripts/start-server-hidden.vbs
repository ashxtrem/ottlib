Option Explicit

Dim shell, folder, launcher
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
launcher = Chr(34) & folder & "\start-server.bat" & Chr(34)

' Window style 0 hides cmd.exe; False lets the server keep running independently.
shell.Run launcher, 0, False
