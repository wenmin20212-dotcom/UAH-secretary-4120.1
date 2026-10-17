const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function alive(pid){if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
function activity(profile){const root=path.join(profile,'data/update-coordination'),pause=path.join(root,'pause.json');
 const atomic=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(t,JSON.stringify(v));fs.renameSync(t,file);};
 function paused(){if(!fs.existsSync(pause))return false;try{const p=JSON.parse(fs.readFileSync(pause));return p.expires>Date.now()&&alive(p.pid);}catch{return true;}}
 function begin(){if(paused())throw Error('Agent 正在准备升级，请安装完成后再发消息');const id=crypto.randomUUID(),file=path.join(root,'jobs',id+'.json');atomic(file,{pid:process.pid,started:Date.now()});if(paused()){fs.unlinkSync(file);throw Error('Agent 正在准备升级');}return ()=>{if(fs.existsSync(file))fs.unlinkSync(file);};}
 function jobs(){const dir=path.join(root,'jobs');if(!fs.existsSync(dir))return 0;return fs.readdirSync(dir).filter(n=>{try{return alive(JSON.parse(fs.readFileSync(path.join(dir,n))).pid);}catch{return true;}}).length;}
 function hold(pid=process.pid){if(paused())throw Error('Another update is waiting for this profile');const nonce=crypto.randomUUID();atomic(pause,{pid,nonce,expires:Date.now()+15*60*1000});return ()=>{if(fs.existsSync(pause)&&JSON.parse(fs.readFileSync(pause)).nonce===nonce)fs.unlinkSync(pause);};}
 return {begin,jobs,hold,paused,clearOwned(){if(fs.existsSync(pause)&&JSON.parse(fs.readFileSync(pause)).pid===process.pid)fs.unlinkSync(pause);}};
}
module.exports={activity,alive};
