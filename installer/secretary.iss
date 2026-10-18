#ifndef Payload
 #error Payload required
#endif
#ifndef Output
 #error Output required
#endif
[Setup]
AppId={{7F02F23D-A4D2-4D83-9A3B-B90E5E12B515}
AppName=私人公司对外联络秘书 — ESCO 4120.1
AppVersion=0.1.5
AppVerName=私人公司对外联络秘书 — ESCO 4120.1 0.1.5 prototype
AppPublisher=wenmin20212-dotcom
DefaultDirName={localappdata}\Programs\UAH-Secretary-4120.1
DefaultGroupName=私人公司对外联络秘书 — ESCO 4120.1
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableProgramGroupPage=yes
OutputDir={#Output}
OutputBaseFilename=UAH-Secretary-4120.1-0.1.5-win-x64-Setup
SetupIconFile={#Payload}\assets\agent.ico
UninstallDisplayIcon={app}\assets\agent.ico
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
RestartApplications=no
LicenseFile={#Payload}\LICENSE-Goose
InfoBeforeFile={#Payload}\安装说明.txt
[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{autoprograms}\私人公司对外联络秘书 — ESCO 4120.1"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\agent.ico"
Name: "{autodesktop}\私人公司对外联络秘书 — ESCO 4120.1"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\agent.ico"
[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch.ps1"""; WorkingDir: "{app}"; Description: "启动秘书"; Flags: nowait postinstall skipifsilent