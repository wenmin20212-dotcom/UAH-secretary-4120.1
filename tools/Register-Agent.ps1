param(
 [ValidateSet('inspect','register','list')][string]$Action='inspect',
 [string]$AgentDirectory,
 [Parameter(Mandatory=$true)][string]$DataRoot,
 [string]$NodePath
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
if(!$NodePath){$NodePath=Join-Path $repoRoot 'runtime\node.exe'}
if(!(Test-Path -LiteralPath $NodePath)){throw 'Provide -NodePath pointing to Node.js 24 or later'}
$registryScript=Join-Path $repoRoot 'execution\agent-registry.cjs'
if($Action -ne 'list' -and !$AgentDirectory){throw 'AgentDirectory is required'}
& $NodePath $registryScript $Action $DataRoot $AgentDirectory
if($LASTEXITCODE -ne 0){throw 'Agent registration failed; existing records were preserved'}
