const path=require('node:path'),crypto=require('node:crypto');
const {createStore,digest}=require('./mail-drafts.cjs');
// No confirmation flags or send operation are exposed by MCP or uah-work.
function createReview({store,runtime,confirm}){
 return async id=>{const d=store.get(id);if(!['draft','failed'].includes(d.status))throw Error('This draft has already been submitted; check its result');
  const status=runtime.status('gmail');if(!status.sendAuthorized)throw Error('Sending is not authorized. Connect Gmail sending first.');
  store.verifyAttachments?.(d);
  const reviewed={id:d.id,revision:d.revision,digest:digest(d)},account=status.sendAccount;
  if(!account)throw Error('Sending account unavailable');
  const approved=await confirm({account,...d});if(!approved)return {status:'cancelled',draft:store.get(id)};
  const fresh=runtime.status('gmail');if(!fresh.sendAuthorized||fresh.sendAccount!==account)throw Error('Sending account changed; review again');
  return store.deliver(reviewed,draft=>runtime.deliverMail(draft,account));
 };
}
const windows=new Map();
function show({profileRoot,productId}){
 const {BrowserWindow,ipcMain,dialog}=require('electron'),key=path.resolve(profileRoot)+'|'+productId;
 if(windows.has(key)){windows.get(key).focus();return {opened:true};}
 const store=createStore({profileRoot,productId}),runtime=require('./runtime.cjs').createRuntime({profileRoot,productId,timeoutMs:15*60*1000});
 const channel='uah-mail-'+crypto.randomUUID();
 const win=new BrowserWindow({title:'邮件草稿 · 预览与确认',width:880,height:760,webPreferences:{preload:path.join(__dirname,'mail-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,additionalArguments:['--uah-mail-channel='+channel]}});
 win.uahMailReview=true;windows.set(key,win);let confirming=false;
 const review=createReview({store,runtime,confirm:async d=>{const result=await dialog.showMessageBox(win,{type:'question',title:'最终确认发送',message:'确认发送下面这一版邮件？',detail:`发件账号：${d.account}\n收件人：${d.to.join(', ')}\n抄送：${(d.cc||[]).join(', ')||'无'}\n密送：${(d.bcc||[]).join(', ')||'无'}\n附件：${(d.attachments||[]).map(a=>a.name+' ('+a.size+' bytes)').join('；')||'无'}\n主题：${d.subject}\n版本：${d.revision}\n\n${d.body.slice(0,1000)}${d.body.length>1000?"\n…正文较长，完整内容见草稿窗口。":""}`,buttons:['取消','确认发送'],defaultId:0,cancelId:0,noLink:true});return result.response===1;}});
 ipcMain.handle(channel,async(event,request)=>{
  if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Mail review source rejected');
  try{if(confirming)throw Error('A send confirmation is in progress');switch(request?.action){
   case 'list':return {drafts:store.list(),gmail:runtime.status('gmail')};
   case 'save':return store.save(request.draft);
   case 'attachments':{const selected=await dialog.showOpenDialog(win,{title:'选择邮件附件',properties:['openFile','multiSelections']});return {attachments:selected.canceled?[]:require('./mail-attachments.cjs').createAttachments(profileRoot).normalize(selected.filePaths.map(path=>({path})))};}
   case 'view-attachment':{const fs=require('node:fs'),a=request.attachment,files=require('./mail-attachments.cjs').createAttachments(profileRoot),bytes=files.read(a);const dir=path.join(profileRoot,'data/connectors/mail-preview',a.sha256);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,a.name);fs.writeFileSync(file,bytes);require('electron').shell.showItemInFolder(file);return {opened:true};}
   case 'connect':return await runtime.connect('gmail','send');
   case 'review':confirming=true;try{return await review(request.id);}finally{confirming=false;}
   default:throw Error('Unsupported mail review action');
  }}catch(e){return {error:e.message};}
 });
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 win.on('closed',()=>{windows.delete(key);ipcMain.removeHandler(channel);void runtime.shutdown();});
 void win.loadFile(path.join(__dirname,'mail-review.html'));return {opened:true};
}
module.exports={show,createReview};
