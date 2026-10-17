const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
function content(value){
 if(!value||Object.keys(value).some(k=>!['to','cc','bcc','subject','body','attachments'].includes(k)))throw Error('Unsupported mail field');
 if(!Array.isArray(value.to)||value.to.length<1||value.to.length>20||value.to.some(s=>typeof s!=='string'||s.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(s)))throw Error('Enter 1–20 plain email addresses');
 if(typeof value.subject!=='string'||!value.subject.trim()||value.subject.length>200||/[\r\n\x00-\x1f\x7f]/.test(value.subject))throw Error('Invalid subject');
 if(typeof value.body!=='string'||!value.body.trim()||value.body.length>20000||value.body.includes('\0'))throw Error('Plain text body must contain 1–20000 characters');
 const address=s=>typeof s==='string'&&s.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(s);
 for(const k of ['cc','bcc'])if(value[k]!==undefined&&(!Array.isArray(value[k])||value[k].some(s=>!address(s))))throw Error('Invalid '+k+' addresses');
 if(value.to.length+(value.cc||[]).length+(value.bcc||[]).length>20)throw Error('At most 20 recipients in total');
 const attachments=value.attachments||[];if(!Array.isArray(attachments)||attachments.length>10||attachments.reduce((n,a)=>n+a.size,0)>18*1024*1024)throw Error('Attachment limits exceeded');
 return {to:[...new Set(value.to)],cc:[...new Set(value.cc||[])],bcc:[...new Set(value.bcc||[])],subject:value.subject,body:value.body,attachments:attachments.map(require('./mail-attachments.cjs').metadata)};
}
const digest=d=>crypto.createHash('sha256').update(JSON.stringify(content({to:d.to,cc:d.cc,bcc:d.bcc,subject:d.subject,body:d.body,attachments:d.attachments}))).digest('hex');
function createStore({profileRoot,productId}){
 const attachments=require('./mail-attachments.cjs').createAttachments(profileRoot);
 const file=require('./runtime.cjs').safe(profileRoot,'data/connectors/mail-drafts.sqlite');
 function open(){fs.mkdirSync(path.dirname(file),{recursive:true});const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, product TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, content TEXT NOT NULL, updated TEXT NOT NULL, receipt TEXT);');return db;}
 const run=fn=>{const db=open();try{return fn(db);}finally{db.close();}};
 function row(db,id){if(typeof id!=='string'||!/^mail-[a-f0-9]{32}$/.test(id))throw Error('Invalid draft id');const r=db.prepare('SELECT * FROM drafts WHERE id=? AND product=?').get(id,productId);if(!r)throw Error('Draft not found in this instance');return {id:r.id,revision:r.revision,status:r.status,updated:r.updated,...JSON.parse(r.content),...(r.receipt?{receipt:JSON.parse(r.receipt)}:{})};}
 const get=id=>run(db=>row(db,id));
 function save({id,revision,...input}){const c=content({...input,attachments:attachments.normalize(input.attachments)});return run(db=>{db.exec('BEGIN IMMEDIATE');if(id){const old=row(db,id);if(old.revision!==revision)throw Error('Draft changed; reload before editing');if(!['draft','failed'].includes(old.status))throw Error('Sending, sent or uncertain drafts cannot be edited or resent');db.prepare("UPDATE drafts SET revision=revision+1, status='draft',content=?,updated=?,receipt=NULL WHERE id=? AND product=?").run(JSON.stringify(c),new Date().toISOString(),id,productId);}else{id='mail-'+crypto.randomUUID().replaceAll('-','');db.prepare("INSERT INTO drafts VALUES(?,?,1,'draft',?,?,NULL)").run(id,productId,JSON.stringify(c),new Date().toISOString());}const result=row(db,id);db.exec('COMMIT');return result;});}
 // Called only by the trusted desktop review handler after native confirmation.
 async function deliver(reviewed,send){
  attachments.verify(get(reviewed.id).attachments);
  const claimed=run(db=>{db.exec('BEGIN IMMEDIATE');const d=row(db,reviewed.id);if(d.revision!==reviewed.revision||digest(d)!==reviewed.digest||!['draft','failed'].includes(d.status))throw Error('Draft changed or already submitted; review again');db.prepare("UPDATE drafts SET status='sending',updated=? WHERE id=? AND product=?").run(new Date().toISOString(),d.id,productId);db.exec('COMMIT');return d;});
  try{const receipt=await send(claimed);if(!receipt||typeof receipt.id!=='string'||!receipt.id)throw Error('No valid send receipt');run(db=>db.prepare("UPDATE drafts SET status='sent',receipt=?,updated=? WHERE id=? AND product=?").run(JSON.stringify({messageId:receipt.id,sentAt:new Date().toISOString()}),new Date().toISOString(),claimed.id,productId));return get(claimed.id);}catch(e){const definite=Number.isInteger(e.status)&&e.status>=400&&e.status<500;run(db=>db.prepare('UPDATE drafts SET status=?,receipt=?,updated=? WHERE id=? AND product=?').run(definite?'failed':'unknown',JSON.stringify({message:definite?'Gmail rejected the request; review before retry':'Sending result uncertain. Check Sent mail manually; do not resend automatically.'}),new Date().toISOString(),claimed.id,productId));throw Error(definite?'Gmail rejected this email; draft retained':'Sending result uncertain; check Sent mail before taking further action');}
 }
 return {save,get,verifyAttachments:d=>attachments.verify(d.attachments),list:()=>run(db=>db.prepare('SELECT id,revision,status,updated FROM drafts WHERE product=? ORDER BY updated DESC LIMIT 100').all(productId).map(r=>row(db,r.id))),deliver};
}
module.exports={createStore,content,digest};
