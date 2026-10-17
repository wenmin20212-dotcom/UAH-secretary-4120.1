const fs=require('node:fs'),path=require('node:path');
function install({app,root,codeRoot,profile,meta}){
 require('./desktop.cjs').install({app,root,meta});
 const file=process.env.UAH_UPDATE_HEALTH_FILE,nonce=process.env.UAH_UPDATE_HEALTH_NONCE;
 if(file&&(!path.resolve(file).startsWith(path.join(root,'updates/health')+path.sep)||!nonce))throw Error('Invalid updater health path');
 app.on('browser-window-created',(_event,window)=>window.webContents.once('did-finish-load',async()=>{
  try{
   if(meta.desktopIcon){
    const icon=fs.readFileSync(path.join(codeRoot,meta.desktopIcon));
    const mime=meta.desktopIcon.endsWith('.png')?'png':'x-icon';
    await window.webContents.insertCSS(`.goose-icon-animation{background:url("data:image/${mime};base64,${icon.toString('base64')}") center/contain no-repeat!important;animation:none!important}.goose-icon-animation>*{visibility:hidden!important}`);
   }
   if(file){
    fs.mkdirSync(path.dirname(file),{recursive:true});
    require('./core.cjs').atomic(file,{nonce,productId:meta.id,instanceId:require('./core.cjs').config(root).instanceId,profileRoot:profile,codeRoot,windowLoaded:true});
   }
  }catch(error){if(file)require('./core.cjs').atomic(file+'.error.json',{nonce,message:error.message});}
 }));
}
module.exports={install};
