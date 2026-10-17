$ErrorActionPreference='Stop'
Start-Process -FilePath (Join-Path $PSScriptRoot 'runtime\node.exe') -ArgumentList @(('"'+(Join-Path $PSScriptRoot 'updater\launcher.cjs')+'"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
