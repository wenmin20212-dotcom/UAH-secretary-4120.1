const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');const core=require('./core.cjs');
function allowed(url,repository,redirect=false){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Updates require HTTPS');if(u.hostname==='api.github.com'&&u.pathname.startsWith('/repos/'+repository+'/'))return u;if(u.hostname==='github.com'&&u.pathname.startsWith('/'+repository+'/releases/download/'))return u;if(redirect&&u.hostname.endsWith('.githubusercontent.com'))return u;throw Error('Update URL outside configured repository');}
function credentialFile(root){if(!process.env.LOCALAPPDATA)throw Error('Windows user data directory unavailable');const repo=core.config(root).repository;return path.join(process.env.LOCALAPPDATA,'UAH-Updater/credentials',core.hash(repo).slice(0,24)+'.dpapi');}
function token(root){if(process.env.UAH_UPDATE_TOKEN)return process.env.UAH_UPDATE_TOKEN;let file=credentialFile(root);if(!fs.existsSync(file))file=path.join(core.config(root).profileRoot,'update-access.dpapi');if(!fs.existsSync(file))return '';return execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'credential.ps1'),'-Action','read','-Path',file],{encoding:'utf8',windowsHide:true}).trim();}
async function response(url,c,access,limit,redirect=false){const u=allowed(url,c.repository,redirect),headers={Accept:u.hostname==='api.github.com'&&/\/releases\/assets\/\d+$/.test(u.pathname)?'application/octet-stream':'application/vnd.github+json','User-Agent':'UAH-Updater/1.0'};if(u.hostname==='api.github.com'&&access)headers.Authorization='Bearer '+access;const r=await fetch(u,{headers,redirect:'manual',signal:AbortSignal.timeout(300000)});if([301,302,303,307,308].includes(r.status)){if(limit<=0)throw Error('Too many update redirects');return response(new URL(r.headers.get('location'),u).href,c,access,limit-1,true);}if(!r.ok)throw Error('Update server returned HTTP '+r.status);return r;}
async function buffer(url,c,access,max){const r=await response(url,c,access,5);const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>max)throw Error('Update metadata exceeds limit');chunks.push(chunk);}return Buffer.concat(chunks);}
async function check(root){const c=core.config(root);if(!Object.keys(c.trustedKeys).length)return {status:'not_configured',packages:[]};const access=token(root),list=JSON.parse(await buffer('https://api.github.com/repos/'+c.repository+'/releases?per_page=100',c,access,2*1024*1024));if(!Array.isArray(list))throw Error('Invalid release list');const assetName='update-feed-'+c.channel+'.json';const releases=list.filter(r=>!r.draft&&(c.channel!=='stable'||!r.prerelease)&&r.assets?.some(a=>a.name===assetName)).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));if(!releases.length)return {status:'no_feed',packages:[]};const asset=releases[0].assets.find(a=>a.name===assetName);const envelope=JSON.parse(await buffer(asset.url,c,access,2*1024*1024)),verified=core.observeFeed(root,envelope);return {status:'checked',envelope,packages:core.candidates(root,verified)};}
async function download(root,checked,progress=()=>{}){
 const c=core.config(root),access=token(root),out=[];
 const total=checked.packages.reduce((n,p)=>n+p.bytes,0);let completed=0;
 const signed=core.verifyFeed(checked.envelope,c,core.state(root));
 for(const p of checked.packages){
  if(!signed.feed.packages.some(x=>JSON.stringify(x)===JSON.stringify(p)))throw Error('Download package is not signed');
  core.validatePackage(p,c);
  const disk=fs.statfsSync(root);
  if(disk.bavail*disk.bsize<p.bytes+p.unpackedBytes+32*1024*1024)throw Error('Insufficient update staging space');
  const relative='updates/cache/'+crypto.randomUUID(),cache=core.safe(root,relative);
  fs.mkdirSync(cache,{recursive:true});
  try{
   const archive=path.join(cache,'payload.zip'),r=await response(p.url,c,access,5),fd=fs.openSync(archive,'wx'),digest=crypto.createHash('sha256');
   let size=0;
   try{for await(const chunk of r.body){size+=chunk.length;if(size>p.bytes)throw Error('Update archive exceeds signed size');digest.update(chunk);fs.writeSync(fd,chunk);progress({received:completed+size,total});}}finally{fs.closeSync(fd);}
   if(size!==p.bytes||digest.digest('hex')!==p.sha256)throw Error('Update archive integrity failed');
   const directory=path.join(cache,'unpacked');
   execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'expand.ps1'),'-Archive',archive,'-Destination',directory,'-MaxBytes',String(p.unpackedBytes)],{windowsHide:true,timeout:300000});
   out.push(core.recordStage(root,checked.envelope,p,directory));completed+=p.bytes;
  }finally{
   // Re-resolve the exact task-owned cache before recursive cleanup on Windows.
   const target=core.safe(root,relative);
   if(target!==cache||!target.startsWith(path.join(path.resolve(root),'updates/cache')+path.sep))throw Error('Unsafe update cache cleanup');
   fs.rmSync(target,{recursive:true,force:true});
  }
 }
 return out;
}
module.exports={allowed,check,download,credentialFile};
