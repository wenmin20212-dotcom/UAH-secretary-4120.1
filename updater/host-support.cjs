// Shared presentation and single-workspace support for independent desktop agents.
// Upstream licenses and engine executable names are intentionally retained.
const fs=require('node:fs'),path=require('node:path');
const {fileURLToPath}=require('node:url');
const registered=new WeakSet();
function installSingleWorkBridge({ipcMain,workspace,rendererPath,app,browserSettings,topicBridge,mailReview,agentPresence}){
 if(registered.has(ipcMain))return;
 const expected=path.resolve(rendererPath);
 ipcMain.handle('uah-work',async(event,request)=>{
  let actual;
  try{const url=new URL(event.senderFrame?.url);if(url.protocol!=='file:')throw Error();actual=path.resolve(fileURLToPath(url));}catch{throw Error('条目接口仅供当前本地桌面使用');}
  if(actual.toLowerCase()!==expected.toLowerCase())throw Error('条目接口来源不匹配');
  if(request?.action?.startsWith('topic-')&&topicBridge)return topicBridge(request);
  if(request?.action==='inherit'&&topicBridge)return topicBridge({action:'topic-fork',parentId:request.parentId,childId:request.childId});
  if(request?.action==='browser-settings'&&browserSettings)return browserSettings();
  if(request?.action==='agent-registry'&&agentPresence)return agentPresence();
  if(request?.action==='mail-review'&&mailReview)return mailReview();
  if(request?.action==='snapshot')return {work:{mode:'single',...(topicBridge?{topicBinding:true}:{})},workspace,objects:[],sessions:[]};
  // Renderer compatibility only: no collection registry or session mutation is installed.
  if(request?.action==='ingest')return {object:null,warnings:[]};
  if(request?.action==='inherit')return null;
  throw Error('此独立程序未启用集合条目操作');
 });
 registered.add(ipcMain);
 if(app&&browserSettings)app.on('browser-window-created',(_event,window)=>{
  window.webContents.on('did-finish-load',()=>{
   let url;try{url=new URL(window.webContents.getURL());if(url.protocol!=='file:'||path.resolve(fileURLToPath(url)).toLowerCase()!==expected.toLowerCase())return;}catch{return;}
   void window.webContents.executeJavaScript(`(()=>{if(document.getElementById('uah-browser-choice'))return;const b=document.createElement('button');b.id='uah-browser-choice';b.textContent='浏览器 ▾';b.title='选择或切换 Chrome / Edge';b.style.cssText='position:fixed;right:16px;bottom:170px;z-index:2147483647;padding:8px 12px;border:1px solid #888;border-radius:8px;background:Canvas;color:CanvasText;cursor:pointer';b.onclick=async()=>{b.disabled=true;try{const choice=await window.uahWorkBridge({action:'browser-settings'});const names={auto:'自动',chrome:'Chrome',msedge:'Edge'};if(choice?.channel&&names[choice.channel])b.textContent='浏览器：'+names[choice.channel]+' ▾';}catch{b.textContent='浏览器设置失败，点击重试';}finally{b.disabled=false;}};document.body.appendChild(b);})()`).catch(()=>{});
   if(agentPresence)void window.webContents.executeJavaScript("(()=>{if(document.getElementById('uah-agent-registry'))return;const b=document.createElement('button');b.id='uah-agent-registry';b.textContent='Agent 登记';b.style.cssText='position:fixed;right:16px;bottom:314px;z-index:2147483647;padding:8px 12px';b.onclick=async()=>{b.disabled=true;try{await window.uahWorkBridge({action:'agent-registry'});}finally{b.disabled=false;}};document.body.append(b);})()").catch(()=>{});
   if(mailReview)void window.webContents.executeJavaScript(`(()=>{if(document.getElementById('uah-mail-drafts'))return;const b=document.createElement('button');b.id='uah-mail-drafts';b.textContent='邮件草稿';b.style.cssText='position:fixed;right:16px;bottom:266px;z-index:2147483647;padding:8px 12px;border:1px solid #888;border-radius:8px;background:Canvas;color:CanvasText;cursor:pointer';b.onclick=async()=>{try{await window.uahWorkBridge({action:'mail-review'});}catch{b.textContent='邮件窗口打开失败，点击重试';}};document.body.appendChild(b);})()`).catch(()=>{});
  });
 });
}
function identityHints(meta){return `\n# 当前应用身份与实际配置\n应用名称：${meta.name}。版本：${meta.version}。请使用此身份回答当前产品问题。\n当前配置、扩展和连接状态以本实例实际工具回执为准；上游引擎文档不等于本产品已支持该功能。缺少连接器时说明实际缺口，不编造安装命令、OAuth 连通或外部操作结果。\n产品使用范围见本包 README.md 及职业定义。只有讨论上游实现或用户明确询问来源时，才解释上游名称和许可证。许可证与第三方署名原样保留。\n`;
}
function stagePresentation(stage,iconFile){
 const renderer=path.join(stage,'.vite/renderer/main_window'),html=path.join(renderer,'index.html');
 const text=fs.readFileSync(html,'utf8'),link='<link rel="stylesheet" href="./uah-agent-brand.css">';
 if(!text.includes(link)){
  if(text.split('</head>').length!==2)throw Error('Unknown desktop HTML layout: presentation staging stopped');
  fs.writeFileSync(html,text.replace('</head>',link+'\n</head>'));
 }
 const icon=fs.readFileSync(iconFile);
 const png=icon.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const ico=icon.length>=22&&icon.readUInt16LE(0)===0&&icon.readUInt16LE(2)===1&&icon.readUInt16LE(4)>0;
 if(!png&&!ico)throw Error('Agent presentation requires a PNG or ICO icon');
 const css=`/* Current agent watermark; legal notices remain unchanged. */\n.goose-icon-animation{background:url("data:image/${png?'png':'x-icon'};base64,${icon.toString('base64')}") center/contain no-repeat!important;animation:none!important}\n.goose-icon-animation>*{visibility:hidden!important}\n`;
 fs.writeFileSync(path.join(renderer,'uah-agent-brand.css'),css);
 return {watermark:'agent_icon',workMode:'single',upstreamNoticesPreserved:true};
}
module.exports={installSingleWorkBridge,identityHints,stagePresentation};
