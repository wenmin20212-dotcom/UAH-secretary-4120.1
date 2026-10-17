// Presence registry only. Never launches an Agent or reads its accounts/history.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function checkedDirectory(directory){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('Agent directory must be absolute');
 const root=path.resolve(directory);let cursor=path.parse(root).root;
 for(const part of root.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked Agent directories are not supported');}
 if(!fs.statSync(root).isDirectory())throw Error('Agent directory is not a directory');return root;
}
function json(root,name,required=false){const file=path.join(root,name);if(!fs.existsSync(file)){if(required)throw Error('Missing '+name);return null;}const st=fs.lstatSync(file);if(st.isSymbolicLink()||!st.isFile()||st.size>256*1024)throw Error('Invalid or oversized '+name);const bytes=fs.readFileSync(file);return {value:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),sha256:hash(bytes)};}
function inspect(directory){
 const root=checkedDirectory(directory),meta=json(root,'agent.json',true),identity=json(root,'agent-identity.json');const m=meta.value;
 if(typeof m.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>240||typeof m.version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(m.version))throw Error('Invalid Agent id/name/version');
 if(identity&&(identity.value.schema!=='uah-agent-identity/v1'||identity.value.productId!==m.id||!uuid(identity.value.agentUid)))throw Error('Invalid identity manifest');
 if(m.agentUid&&!uuid(m.agentUid))throw Error('Invalid permanent Agent identity');
 if(identity&&m.agentUid&&identity.value.agentUid!==m.agentUid)throw Error('Agent identities conflict');
 const uid=identity?.value.agentUid||m.agentUid,legacy=!uid&&uuid(m.instanceId),location=process.platform==='win32'?root.toLowerCase():root;
 const agentKey=uid?'agent:'+uid.toLowerCase():legacy?'legacy-instance:'+m.instanceId.toLowerCase():'local:'+hash(m.id+'\n'+location);
 const role=m.roleIdentity||null;if(role&&(!/^\d{4}(?:\.\d+)*$/.test(role.escoCode)||!Number.isSafeInteger(role.localSequence)||role.localSequence<1||role.code!==role.escoCode+'-'+String(role.localSequence).padStart(3,'0')))throw Error('Invalid role identity');
 const repository=identity?.value.repositoryUrl||null;if(repository&&!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(repository))throw Error('Invalid repository URL');
 return {schema:'uah-agent-registration-preview/v1',agentKey,identityKind:uid?'permanent':legacy?'legacy_instance':'local_directory',productId:m.id,name:m.name,version:m.version,roleIdentity:role,sourceIncubatorId:identity?.value.sourceIncubatorId||null,repositoryUrl:repository,directory:root,metadataSha256:meta.sha256,identitySha256:identity?.sha256||null,declaredIdentityVerified:false,scope:'presence_only',warnings:[...(!uid?['旧包缺少永久身份；迁移或重新安装后需人工核对，不能保证自动合并']:[]),'登记仅表示发现此程序，不代表已连通、已授权或可接手修改']};
}
function createRegistry(dataRoot){
 if(!path.isAbsolute(dataRoot))throw Error('Registry data directory must be absolute');
 function use(fn){fs.mkdirSync(dataRoot,{recursive:true});const db=new DatabaseSync(path.join(dataRoot,'agent-registry.sqlite'));try{db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS registrations(agentKey TEXT PRIMARY KEY,body TEXT NOT NULL);');return fn(db);}finally{db.close();}}
 function register(directory){const preview=inspect(directory);return use(db=>{db.exec('BEGIN IMMEDIATE');const row=db.prepare('SELECT body FROM registrations WHERE agentKey=?').get(preview.agentKey),old=row?JSON.parse(row.body):null;
  if(old&&(old.productId!==preview.productId||JSON.stringify(old.roleIdentity)!==JSON.stringify(preview.roleIdentity)))throw Error('Registered identity conflicts; no existing entry was overwritten');
  const locationKey=v=>process.platform==='win32'?v.toLowerCase():v,locations=[...(old?.locations||[])];if(!locations.some(v=>locationKey(v)===locationKey(preview.directory)))locations.push(preview.directory);
  const now=new Date().toISOString(),entry={...preview,locations,registeredAt:old?.registeredAt||now,lastObservedAt:now};
  db.prepare('INSERT INTO registrations VALUES(?,?) ON CONFLICT(agentKey) DO UPDATE SET body=excluded.body').run(entry.agentKey,JSON.stringify(entry));db.exec('COMMIT');return {status:old?'updated':'registered',agent:entry};});}
 function list(){return use(db=>({schema:'uah-agent-registry/v1',scope:'presence_only',agents:db.prepare('SELECT body FROM registrations ORDER BY agentKey').all().map(r=>{const e=JSON.parse(r.body);return {...e,locations:e.locations.map(directory=>({directory,available:fs.existsSync(directory)})),onlineStatus:'not_checked',authorization:'not_granted_by_registration'};})}));}
 return {inspect,register,list};
}
if(require.main===module){try{const [action,dataRoot,directory]=process.argv.slice(2);if(!['inspect','register','list'].includes(action))throw Error('Usage: node agent-registry.cjs inspect|register|list <dataRoot> [AgentDirectory]');const r=createRegistry(path.resolve(dataRoot));console.log(JSON.stringify(action==='list'?r.list():action==='inspect'?r.inspect(directory):r.register(directory),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={inspect,createRegistry};
