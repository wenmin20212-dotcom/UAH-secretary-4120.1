param([ValidateSet('check','history','rollback','authorize')][string]$Action='check')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$root=Split-Path -Parent $PSScriptRoot
function Invoke-Updater([string]$Command){
 $temp=Join-Path $root ('updates/ui-'+[Guid]::NewGuid().ToString());[IO.Directory]::CreateDirectory($temp)|Out-Null
 $out=Join-Path $temp 'result.json';$err=Join-Path $temp 'error.txt'
 $args=@(('"'+(Join-Path $PSScriptRoot 'cli.cjs')+'"'),$Command)
 $p=Start-Process -FilePath (Join-Path $root 'runtime/node.exe') -ArgumentList $args -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
 if($p.ExitCode-ne0){throw 'Update operation did not finish. See local update logs.'}
 return ([IO.File]::ReadAllText($out,[Text.Encoding]::UTF8)|ConvertFrom-Json)
}
try{
 if($Action-eq'authorize'){
  $form=New-Object Windows.Forms.Form;$form.Text='更新下载授权';$form.Width=460;$form.Height=180;$form.StartPosition='CenterScreen'
  $label=New-Object Windows.Forms.Label;$label.Text='输入此更新仓库的只读 GitHub 访问令牌（不是模型账号）';$label.SetBounds(15,15,420,40)
  $box=New-Object Windows.Forms.TextBox;$box.UseSystemPasswordChar=$true;$box.SetBounds(15,60,410,25)
  $button=New-Object Windows.Forms.Button;$button.Text='保存';$button.SetBounds(330,95,95,28);$button.DialogResult=[Windows.Forms.DialogResult]::OK
  $form.Controls.AddRange(@($label,$box,$button));$form.AcceptButton=$button
  if($form.ShowDialog()-eq[Windows.Forms.DialogResult]::OK-and$box.Text){$location=(Invoke-Updater 'credential-location').path;[IO.Directory]::CreateDirectory((Split-Path -Parent $location))|Out-Null;$secure=ConvertTo-SecureString $box.Text -AsPlainText -Force;[IO.File]::WriteAllText($location,($secure|ConvertFrom-SecureString));$box.Clear();[Windows.Forms.MessageBox]::Show('已保存当前 Windows 用户的下载授权。模型设置没有改变。','更新授权')|Out-Null};$form.Dispose();exit
 }
 if($Action-eq'history'){$r=Invoke-Updater 'status';$lines=@('当前程序：'+$r.productId,'更新中心：'+$r.repository);foreach($h in $r.history){$lines+=($h.at+'  '+$h.result)};[Windows.Forms.MessageBox]::Show(($lines-join"`r`n"),'更新记录')|Out-Null;exit}
 if($Action-eq'rollback'){if([Windows.Forms.MessageBox]::Show('请先退出这个 Agent。恢复上一版程序会保留当前用户资料。是否继续？','恢复上一版','YesNo')-ne'Yes'){exit};Invoke-Updater 'rollback'|Out-Null;[Windows.Forms.MessageBox]::Show('已恢复上一版程序，请重新启动。','更新')|Out-Null;exit}
 $r=Invoke-Updater 'check'
 if($r.status-eq'not_configured'-or$r.status-eq'no_feed'){[Windows.Forms.MessageBox]::Show('当前通道暂时没有可用更新，或更新验证信息尚未配置。','检查更新')|Out-Null;exit}
 if(!$r.packages.Count){[Windows.Forms.MessageBox]::Show('当前没有适合这个 Agent 的新版本。','检查更新')|Out-Null;exit}
 if([Windows.Forms.MessageBox]::Show('发现兼容更新。现在下载，退出并重新打开程序后生效。是否下载？','检查更新','YesNo')-eq'Yes'){Invoke-Updater 'download'|Out-Null;[Windows.Forms.MessageBox]::Show('更新已下载。退出并重新打开这个 Agent 时安装，原有模型设置和资料保留。','更新')|Out-Null}
}catch{[Windows.Forms.MessageBox]::Show('更新未完成。请检查网络及更新下载授权；原有程序和模型设置未被重置。','更新')|Out-Null}
