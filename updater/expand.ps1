param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Destination,[Parameter(Mandatory=$true)][long]$MaxBytes)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function LongPath([string]$Value){
 if($Value.StartsWith('\\?\')){return $Value}
 if($Value.StartsWith('\\')){return '\\?\UNC\'+$Value.Substring(2)}
 if($Value-notmatch'^[A-Za-z]:\\'){throw 'Expected an absolute Windows path'}
 return '\\?\'+$Value
}
if(![IO.Path]::IsPathRooted($Destination)-or![IO.Path]::IsPathRooted($Archive)){throw 'Absolute archive and destination paths required'}
$Destination=$Destination.TrimEnd('\')
$LongDestination=LongPath $Destination
if([IO.Directory]::Exists($LongDestination)-or[IO.File]::Exists($LongDestination)){throw 'Extraction destination exists'}
$zip=[IO.Compression.ZipFile]::OpenRead((LongPath $Archive))
try{
 $seen=@{};$total=0L
 if($zip.Entries.Count-gt100000){throw 'Too many ZIP entries'}
 foreach($entry in $zip.Entries){
  $name=$entry.FullName.Replace('\','/').TrimEnd('/')
  if(!$name-or$name.StartsWith('/')-or$name-match'(^|/)\.\.?(/|$)|[<>:"|?*\x00-\x1f]' -or ($name.Split('/')|Where-Object {$_-match'[. ]$|^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)'})){throw 'Unsafe ZIP entry'}
  if($seen.ContainsKey($name.ToLowerInvariant())){throw 'Duplicate ZIP entry'};$seen[$name.ToLowerInvariant()]=$true
  if((($entry.ExternalAttributes-shr16)-band0xF000)-eq0xA000){throw 'ZIP links rejected'}
  $total+=$entry.Length;if($total-gt$MaxBytes){throw 'ZIP exceeds signed size'}
 }
 [IO.Directory]::CreateDirectory($LongDestination)|Out-Null
 foreach($entry in $zip.Entries){
  $target=$Destination+'\'+$entry.FullName.Replace('/','\')
  if(!$target.StartsWith($Destination+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'ZIP escaped destination'}
  if($entry.FullName.EndsWith('/')-or$entry.FullName.EndsWith('\')){[IO.Directory]::CreateDirectory((LongPath $target))|Out-Null;continue}
  [IO.Directory]::CreateDirectory((LongPath ([IO.Path]::GetDirectoryName((LongPath $target)))))|Out-Null
  $inputStream=$entry.Open();$outputStream=[IO.File]::Open((LongPath $target),[IO.FileMode]::CreateNew)
  try{$inputStream.CopyTo($outputStream)}finally{$inputStream.Dispose();$outputStream.Dispose()}
 }
}finally{$zip.Dispose()}
