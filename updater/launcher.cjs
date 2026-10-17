const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {spawn,execFileSync}=require('node:child_process');const core=require('./core.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(root,{spawnApp,healthTimeout=60000,network=true}={}){
 root=path.resolve(root);if(core.running(root))return {status:'already_running'};
 const lock=path.join(root,'updates/launcher.lock');let fd;
 try{fd=core.lockFile(lock);fs.writeFileSync(fd,String(process.pid));return await launchOwned(root,{spawnApp,healthTimeout,network});}finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}
}
async function launchOwned(root,{spawnApp,healthTimeout,network}){
 const resume=core.state(root).transaction?.status==='awaiting_launch';
 if(core.state(root).transaction&&!resume)core.finish(root,false,'Previous launch interrupted before health confirmation');
 let activated;
 if(resume){core.locked(root,()=>{const s=core.state(root);s.transaction.status='awaiting_health';core.atomic(path.join(root,'updates/state.json'),s);});activated={status:'activated'};}else{
  try{activated=core.activate(root);}catch(error){
   core.atomic(path.join(root,'updates/install-error.json'),{at:new Date().toISOString(),message:String(error.message).slice(0,500)});
   require('./activity.cjs').activity(core.config(root).profileRoot).clearOwned();
   if(core.state(root).transaction)throw error;
   activated={status:'not_applied'};network=false;
  }
 }
 try{
  const result=await runPrepared(root,{spawnApp,healthTimeout,network},activated);
  if(result.installRequest){
   fs.unlinkSync(path.join(root,'updates/install-request.json'));
   if(result.installRequest.restart)return launchOwned(root,{spawnApp,healthTimeout,network:false});
   const installed=core.activate(root);
   if(installed.status==='activated')core.locked(root,()=>{const s=core.state(root);s.transaction.status='awaiting_launch';core.atomic(path.join(root,'updates/state.json'),s);});
   require('./activity.cjs').activity(core.config(root).profileRoot).clearOwned();
   return {status:'installed_restart_later',activation:installed.status};
  }
  return result;
 }catch(e){require('./activity.cjs').activity(core.config(root).profileRoot).clearOwned();if(core.state(root).transaction&&!core.running(root)){core.finish(root,false,'Updater/application launch failed: '+e.message);return launchOwned(root,{spawnApp,healthTimeout,network:false});}throw e;}
}
async function runPrepared(root,{spawnApp,healthTimeout,network},activated){
 const ctx=core.context(root),engine=ctx.state.active.host?.package.updaterVersion?path.join(ctx.host,'updater-engine'):path.join(root,'updater');
 if(path.resolve(engine)!==path.resolve(__dirname))return require(path.join(engine,'launcher.cjs')).runPrepared(root,{spawnApp,healthTimeout,network},activated);
 const nonce=crypto.randomUUID(),ready=core.safe(root,'updates/health/'+nonce+'.json');
 const lease=path.join(root,'updates/running.json');fs.mkdirSync(path.dirname(lease),{recursive:true});core.atomic(lease,{pid:process.pid,nonce});
 const env={...process.env,UAH_AGENT_ROOT:root,UAH_AGENT_CODE_ROOT:ctx.product,UAH_HOST_ROOT:ctx.host,UAH_HOST_VERSION:ctx.state.active.host?.version||ctx.config.hostVersion,UAH_UPDATE_ENGINE_ROOT:engine,UAH_UPDATE_LAUNCHER_PID:String(process.pid),UAH_PRODUCT_BOOTSTRAP:ctx.bootstrap,UAH_UPDATE_HEALTH_FILE:ready,UAH_UPDATE_HEALTH_NONCE:nonce};
 delete env.UAH_UPDATE_TOKEN;
 const executable=path.join(ctx.host,'app/BOSS-win32-x64/BOSS.exe');
 let child,closed=false,healthy=false;
 try{
  fs.mkdirSync(ctx.workspace,{recursive:true});
  child=spawnApp?spawnApp({executable,env,ctx}):spawn(executable,[],{cwd:ctx.workspace,env,windowsHide:false,stdio:'ignore'});
  core.atomic(lease,{pid:process.pid,childPid:child.pid,nonce});
  child.once('error',()=>{closed=true;});child.once('exit',()=>{closed=true;});
  if(network&&ctx.config.autoCheck&&!ctx.config.interactiveUpdates){void(async()=>{try{const api=require('./github.cjs'),checked=await api.check(root);if(ctx.config.autoDownload&&checked.packages.length)await api.download(root,checked);}catch(e){core.atomic(path.join(root,'updates/last-check.json'),{at:new Date().toISOString(),status:'failed',message:String(e.message).slice(0,300)});}})();}
  const end=Date.now()+healthTimeout;while(!closed&&Date.now()<end){if(fs.existsSync(ready)){try{const r=core.read(ready);if(r.nonce===nonce&&r.productId===ctx.config.productId&&r.instanceId===ctx.config.instanceId&&path.resolve(r.profileRoot).toLowerCase()===path.resolve(ctx.profileRoot).toLowerCase()&&r.windowLoaded){healthy=true;break;}}catch{/* Health file may still be completing its write. */}}await delay(100);}
  if(!healthy){if(!closed&&child.pid){if(process.platform==='win32'&&!spawnApp)execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32/taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill();for(let i=0;i<50&&!closed;i++)await delay(100);}if(!closed)throw Error('Application still running; rollback postponed');if(fs.existsSync(lease))fs.unlinkSync(lease);if(activated.status==='activated'){core.finish(root,false,'New version failed window health check');return launchOwned(root,{spawnApp,healthTimeout,network:false});}throw Error('Application did not reach window-loaded state');}
  if(core.state(root).transaction)core.finish(root,true);require('./activity.cjs').activity(ctx.profileRoot).clearOwned();
  if(!closed)await new Promise(resolve=>{child.once('exit',resolve);child.once('error',resolve);});
  let installRequest;const request=path.join(root,'updates/install-request.json');if(fs.existsSync(request)){const r=core.read(request);if(r.schema==='uah-install-request/v1'&&r.nonce===nonce&&typeof r.restart==='boolean'&&Number.isFinite(r.created)&&Math.abs(Date.now()-r.created)<15*60*1000)installRequest=r;}return {status:'exited',healthy:true,...(installRequest?{installRequest}:{})};
 }catch(e){if(child&&!closed&&child.pid){try{if(process.platform==='win32'&&!spawnApp)execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32/taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill();for(let i=0;i<50&&!closed;i++)await delay(100);}catch{}}throw e;}finally{if((!child||closed)&&fs.existsSync(lease)){const r=core.read(lease);if(r.nonce===nonce)fs.unlinkSync(lease);}}
}
if(require.main===module)launch(path.resolve(__dirname,'..')).catch(e=>{try{core.atomic(path.join(__dirname,'../updates/launch-error.json'),{message:e.message,at:new Date().toISOString()});}catch{}process.exitCode=1;});
module.exports={launch,runPrepared};
