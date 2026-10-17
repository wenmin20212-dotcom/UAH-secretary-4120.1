const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const labels={auto:'自动',chrome:'Chrome',msedge:'Edge'};
function location(profileRoot){return require('./runtime.cjs').safe(profileRoot,'data/connectors/browser-choice.json');}
function read(profileRoot){const file=location(profileRoot);if(!fs.existsSync(file))return {channel:'auto',revision:''};const value=JSON.parse(fs.readFileSync(file,'utf8'));if(!Object.hasOwn(labels,value.channel)||typeof value.revision!=='string')throw Error('Invalid browser preference');return value;}
function write(profileRoot,channel){if(!Object.hasOwn(labels,channel))throw Error('Unsupported browser choice');const file=location(profileRoot),value={channel,revision:crypto.randomUUID()};fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(value),{flag:'wx'});fs.renameSync(temp,file);return value;}
let showing=false;
async function show({profileRoot,dialog}){
 if(showing)return {busy:true};showing=true;
 try{const current=read(profileRoot),available=require('./adapters/browser.cjs').channels(),choices=['auto',...available];
 const pick=await dialog.showMessageBox({type:'question',title:'选择浏览器',message:'浏览器：'+labels[current.channel],detail:'可随时切换。Chrome 和 Edge 分别保留本 Agent 的登录资料。',buttons:[...choices.map(c=>labels[c]),'取消'],defaultId:Math.max(0,choices.indexOf(current.channel)),cancelId:choices.length,noLink:true});
 if(pick.response>=choices.length)return current;const channel=choices[pick.response];if(channel===current.channel)return current;
 if(!fs.existsSync(require('./runtime.cjs').safe(profileRoot,'data/connectors/browser.lock')))return write(profileRoot,channel);
 const confirm=await dialog.showMessageBox({type:'warning',title:'切换浏览器',message:'切换会关闭本 Agent 当前的浏览器窗口。',detail:'请先提交或保存网页中的内容。正在进行的操作结束后切换；不会复制两个浏览器之间的登录资料。',buttons:['切换','取消'],defaultId:1,cancelId:1,noLink:true});
 return confirm.response===0?write(profileRoot,channel):current;
 }finally{showing=false;}
}
module.exports={read,write,show,labels};
