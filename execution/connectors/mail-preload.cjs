const {contextBridge,ipcRenderer}=require('electron');
const channel=process.argv.find(x=>x.startsWith('--uah-mail-channel='))?.slice('--uah-mail-channel='.length);
if(!channel)throw Error('Missing mail review channel');
contextBridge.exposeInMainWorld('mailReview',{request:r=>ipcRenderer.invoke(channel,r)});
