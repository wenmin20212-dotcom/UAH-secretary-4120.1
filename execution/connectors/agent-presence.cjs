const path=require('node:path');
async function show({profileRoot,dialog}){
 const registry=require('../agent-registry.cjs').createRegistry(path.join(profileRoot,'data/agent-registry'));
 const list=registry.list().agents;
 const choice=await dialog.showMessageBox({type:'info',title:'Agent 登记',message:'已知的 Agent',detail:list.length?list.map(a=>`${a.name} · ${a.version}\n${a.agentKey}\n${a.locations.map(l=>l.directory+(l.available?'':'（目录不可用）')).join('\n')}`).join('\n\n'):'尚未登记其他 Agent。登记只表示知道存在，不代表在线、授权或可以派工。',buttons:['登记外来 Agent','关闭'],defaultId:1,cancelId:1});
 if(choice.response!==0)return {status:'closed'};
 const selected=await dialog.showOpenDialog({title:'选择外来 Agent 安装目录',properties:['openDirectory']});if(selected.canceled||selected.filePaths.length!==1)return {status:'cancelled'};
 const preview=registry.inspect(selected.filePaths[0]);
 const confirm=await dialog.showMessageBox({type:'question',title:'确认 Agent 登记',message:preview.name,detail:`版本：${preview.version}\n身份：${preview.agentKey}\n编号：${preview.roleIdentity?.code||'未知'}\n目录：${preview.directory}\n\n${preview.warnings.join('\n')}`,buttons:['确认登记','取消'],defaultId:1,cancelId:1});
 if(confirm.response!==0)return {status:'cancelled'};
 const current=registry.inspect(preview.directory);if(current.metadataSha256!==preview.metadataSha256||current.identitySha256!==preview.identitySha256)throw Error('身份文件已变化，请重新分析确认');
 const result=registry.register(preview.directory);await dialog.showMessageBox({type:'info',title:'Agent 登记',message:'已登记：'+result.agent.name,detail:'此登记未启动外来程序，也未授予调用权限。',buttons:['关闭']});return {status:result.status};
}
module.exports={show};
