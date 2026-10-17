const fs=require('node:fs'),path=require('node:path'),core=require('./core.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function coordinator({root,nonce,ownerPid=process.pid,api=require('./github.cjs'),quit,notify=()=>{},idleTimeout=10*60*1000}){
 let busy=false,release;
 return {get busy(){return busy;},async update(checked,{restart=true}={}){if(busy)throw Error('Update already in progress');busy=true;try{
  if(!nonce||!core.running(root))throw Error('Start this Agent using its normal updated shortcut first');
  await api.download(root,checked,p=>notify({phase:'download',...p}));
  if(!Object.keys(core.state(root).pending||{}).length)throw Error('No verified update is staged');
  const lease=require('./activity.cjs').activity(core.config(root).profileRoot);release=lease.hold(ownerPid);const end=Date.now()+idleTimeout;
  while(lease.jobs()){notify({phase:'waiting'});if(Date.now()>end)throw Error('手机任务尚未结束，已保留下载，请稍后再安装');await sleep(250);}
  core.atomic(path.join(root,'updates/install-request.json'),{schema:'uah-install-request/v1',nonce,restart,created:Date.now()});notify({phase:'closing'});quit();return {status:'waiting_for_exit'};
 }catch(e){release?.();busy=false;throw e;}},cancel(){release?.();busy=false;}};
}
function install({app,root,meta}){
 const {dialog,Menu,MenuItem}=require('electron');let window,checking=false,seen='',controller,stopped=false;
 async function check(manual=false){if(stopped||checking||controller?.busy||!window||window.isDestroyed())return;checking=true;try{
  const config=core.config(root);if(!manual&&!config.autoCheck)return;
  const checked=await require('./github.cjs').check(root);if(!checked.packages.length){if(manual)await dialog.showMessageBox(window,{message:'当前没有适合此 Agent 的新版本。',buttons:['确定']});return;}
  const key=checked.packages.map(p=>p.sha256).join('|');if(!manual&&key===seen)return;seen=key;
  const description=checked.packages.map(p=>`${p.component==='host'?'通用程序':'本 Agent'} ${p.version}\n${String(p.releaseNotes||'功能说明以发布记录为准。').slice(0,4000)}`).join('\n\n');
  const choice=await dialog.showMessageBox(window,{type:'info',title:meta.name+' · 发现新版本',message:'发现可用更新',detail:description+'\n\n请先结束电脑端正在执行的任务并保存编辑。下载校验成功后将正常退出应用、备份安装；手机任务会等待结束。模型设置、授权和资料保留。',buttons:['稍后','下载升级并重启','下载升级，稍后手动启动'],defaultId:0,cancelId:0,noLink:true});
  if(![1,2].includes(choice.response))return;
  controller=coordinator({root,nonce:process.env.UAH_UPDATE_HEALTH_NONCE,ownerPid:Number(process.env.UAH_UPDATE_LAUNCHER_PID)||process.pid,quit:()=>app.quit(),notify:p=>{if(!window.isDestroyed()){if(p.phase==='download')window.setTitle(meta.name+' · 正在下载更新');window.setProgressBar(p.phase==='download'?(p.total?p.received/p.total:2):-1);if(p.phase==='waiting')window.setTitle(meta.name+' · 等待手机任务结束');}}});
  await controller.update(checked,{restart:choice.response===1});
 }catch(e){controller?.cancel();if(window&&!window.isDestroyed()){window.setProgressBar(-1);window.setTitle(meta.displayName||meta.name);await dialog.showMessageBox(window,{type:'error',title:'更新未完成',message:'原程序继续使用',detail:String(e.message),buttons:['确定']});}}finally{checking=false;}}
 app.on('browser-window-created',(_e,w)=>{if(w.uahMailReview)return;w.webContents.once('did-finish-load',()=>{if(w.uahMailReview||window)return;window=w;const menu=Menu.getApplicationMenu()||new Menu();menu.append(new MenuItem({label:'程序更新',submenu:[{label:'检查新版本…',click:()=>void check(true)}]}));Menu.setApplicationMenu(menu);const first=setTimeout(()=>void check(),10000);first.unref();});});
 const timer=setInterval(()=>void check(),4*60*60*1000);timer.unref();app.on('will-quit',()=>{stopped=true;clearInterval(timer);});
 return {check};
}
module.exports={install,coordinator};
