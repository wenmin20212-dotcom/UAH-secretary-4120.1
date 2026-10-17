param([ValidateSet('protect','unprotect')][string]$Action)
$ErrorActionPreference='Stop'
$inputText=[Console]::In.ReadToEnd().Trim()
if($Action-eq'protect'){
 $plain=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($inputText))
 $secure=ConvertTo-SecureString $plain -AsPlainText -Force
 [Console]::Out.Write(($secure|ConvertFrom-SecureString))
}else{
 $secure=ConvertTo-SecureString $inputText
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);[Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($plain)))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
