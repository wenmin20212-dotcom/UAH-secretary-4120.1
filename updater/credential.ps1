param([ValidateSet('read','set')][string]$Action='set',[Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
if($Action-eq'set'){
 $secret=Read-Host 'GitHub read-only update access token (not model credentials)' -AsSecureString
 [IO.Directory]::CreateDirectory((Split-Path -Parent $Path))|Out-Null
 [IO.File]::WriteAllText($Path,($secret|ConvertFrom-SecureString))
}else{
 $secret=ConvertTo-SecureString ([IO.File]::ReadAllText($Path))
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 try{[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
