const fs=require('node:fs'),path=require('node:path');
const names=['web-read.cjs','agent-presence.cjs','catalog.cjs','catalog.json','browser-skill.md','browser-settings.cjs','mail-skill.md','mail-drafts.cjs','mail-attachments.cjs','mail-review.cjs','mail-preload.cjs','mail-review.html','mail-review-renderer.js','runtime.cjs','bootstrap.cjs','mcp.mjs','vault.ps1','open-browser.ps1','package.cjs'];
function stage(output){
 const target=path.join(output,'execution/connectors');fs.mkdirSync(target,{recursive:true});
 fs.copyFileSync(path.join(__dirname,'../agent-registry.cjs'),path.join(output,'execution/agent-registry.cjs'));
 for(const name of names)fs.copyFileSync(path.join(__dirname,name),path.join(target,name));
 fs.mkdirSync(path.join(target,'adapters'),{recursive:true});for(const d of require('./catalog.cjs').catalog().connectors){const entry=require('./catalog.cjs').verifiedSource(d.id);fs.copyFileSync(entry.file,path.join(target,'adapters',entry.definition.file));}
 const seen=new Set();function dependency(name,from){const resolved=require.resolve(name,{paths:[from]});let directory=path.dirname(resolved);while(path.dirname(directory)!==directory){const file=path.join(directory,'package.json');if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).name===name)break;directory=path.dirname(directory);}const meta=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));if(meta.name!==name)throw Error('Could not resolve connector dependency');const key=name+'@'+meta.version;if(seen.has(key))return;seen.add(key);const dest=path.join(output,'execution/node_modules',name);if(fs.existsSync(dest)){if(JSON.parse(fs.readFileSync(path.join(dest,'package.json'))).version!==meta.version)throw Error('Conflicting connector dependency');}else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(directory,dest,{recursive:true});}for(const child of Object.keys(meta.dependencies||{}))dependency(child,directory);}
 dependency('@modelcontextprotocol/server',__dirname);dependency('zod',__dirname);dependency('playwright-core',__dirname);return {connectorService:true,selectedAccounts:0,dependencies:[...seen]};
}
module.exports={stage};
