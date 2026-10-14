$ErrorActionPreference='Stop'
$root=$PSScriptRoot
Start-Process -FilePath (Join-Path $root 'app\BOSS-win32-x64\BOSS.exe') -WorkingDirectory $root
