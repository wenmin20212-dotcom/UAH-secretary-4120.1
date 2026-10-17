param([Parameter(Mandatory=$true)][string]$Url)
$ErrorActionPreference='Stop'
$uri=[Uri]$Url
if($uri.Scheme-ne'https'-or$uri.Host-ne'accounts.google.com'-or$uri.AbsolutePath-ne'/o/oauth2/v2/auth'){throw 'Unsupported authorization URL'}
Start-Process -FilePath $Url
