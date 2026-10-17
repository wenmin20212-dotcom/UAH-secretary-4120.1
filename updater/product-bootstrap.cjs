const requireHost=require('node:module').createRequire(require('node:path').join(process.resourcesPath,'app.asar/package.json'));
// Standalone child bootstrap: no mother controller or mother workspace references.
const {app,dialog,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),YAML=requireHost('yaml');
const host=requireHost('./uah-standalone-host.cjs');
const root=path.resolve(process.env.UAH_AGENT_ROOT||path.resolve(process.resourcesPath,'../../..'));
const codeRoot=path.resolve(process.env.UAH_AGENT_CODE_ROOT||root),hostRoot=path.resolve(process.env.UAH_HOST_ROOT||root);
try{
 const meta=JSON.parse(fs.readFileSync(path.join(codeRoot,'agent.json'),'utf8'));
 const workspace=path.join(root,'workspace'),desktop=path.join(root,'data/desktop'),configRoot=path.join(root,'data/goose/config');
 for(const p of [workspace,desktop,configRoot])fs.mkdirSync(p,{recursive:true});
 for(const k of ['UAH_INCUBATOR_DATA_ROOT','UAH_INCUBATOR_CHILDREN_ROOT','UAH_INCUBATOR_PROFILE_ROOT','UAH_INCUBATOR_RUNTIME_ROOT','UAHRAF9M_DATA_ROOT','UAHRAF9M_CHILDREN_ROOT','UAHRAF9M_WORK_REGISTRY_ROOT','UAH_REQUIRE_CAPABILITY_POLICY','UAH_CAPABILITY_POLICY','GOOSE_EXTERNAL_BACKEND','GOOSE_EXTERNAL_BACKEND_URL','GOOSE_BINARY'])delete process.env[k];
 process.env.UAH_RUNTIME_MODE='native';process.env.GOOSE_PATH_ROOT=path.join(root,'data/goose');process.env.BOSS_DESKTOP_DATA=desktop;process.env.GOOSE_WORKING_DIR=workspace;process.env.BOSS_DISPLAY_NAME=meta.displayName;
 app.setName(meta.id);app.setPath('userData',desktop);process.chdir(workspace);
 host.installSingleWorkBridge({agentPresence:()=>require(path.join(codeRoot,'execution/connectors/agent-presence.cjs')).show({profileRoot:root,dialog}),mailReview:()=>connectorSupport.showMailReview({profileRoot:root,productId:meta.id}),app,browserSettings:()=>connectorSupport.showBrowserSettings({profileRoot:root,dialog}),ipcMain,workspace,rendererPath:path.join(process.resourcesPath,'app.asar/.vite/renderer/main_window/index.html')});
 const configPath=path.join(configRoot,'config.yaml');const config=fs.existsSync(configPath)?YAML.parse(fs.readFileSync(configPath,'utf8'))||{}:{};
 config.extensions=config.extensions||{};
 for(const c of meta.mcp){if(!config.extensions[c.name])config.extensions[c.name]={enabled:true,type:'stdio',name:c.name,cmd:c.kind==='node'?path.join(hostRoot,'runtime/node.exe'):path.join(codeRoot,'agent',c.entry),args:c.kind==='node'?[path.join(codeRoot,'agent',c.entry),...c.args]:c.args,envs:{},env_keys:c.envKeys,timeout:300,cwd:workspace};}
 const connectorSupport=require(path.join(codeRoot,'execution/connectors/bootstrap.cjs'));
 connectorSupport.configure({config,profileRoot:path.resolve(configRoot,'../../..'),codeRoot,hostRoot,productId:meta.id,selections:meta.connectors||[]});
 fs.writeFileSync(configPath,YAML.stringify(config));
 for(const s of meta.skills){const target=path.join(configRoot,'skills',s.name);if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(codeRoot,'agent',s.path),target,{recursive:true});}}
 const docs=Object.entries(meta.views).flatMap(([view,v])=>v.files.filter(f=>f.endsWith('.md')).map(f=>`## ${view}: ${f}\n`+fs.readFileSync(path.join(codeRoot,'agent',f),'utf8')));
 fs.writeFileSync(path.join(configRoot,'.goosehints'),`# ${meta.name}\n${meta.mode==='prototype'?'这是测试包，未完成的视图不能宣称已实现。':''}\n`+host.identityHints(meta)+connectorSupport.hints+docs.join('\n\n'));
 app.on('browser-window-created',(_e,w)=>{if(meta.desktopIcon)w.setIcon(path.join(codeRoot,meta.desktopIcon));w.on('page-title-updated',e=>{if(w.uahMailReview)return;e.preventDefault();w.setTitle(meta.displayName);});w.webContents.once('did-finish-load',()=>{if(w.uahMailReview)return;w.setTitle(meta.displayName);fs.writeFileSync(path.join(root,'data/runtime-ready.json'),JSON.stringify({windowLoaded:true,id:meta.id,name:meta.name,version:meta.version,standalone:true}));});});
 require(path.join(process.env.UAH_UPDATE_ENGINE_ROOT||path.join(root,'updater'),'health.cjs')).install({app,root,codeRoot,profile:typeof profile==='string'?profile:root,meta});
 requireHost('./.vite/build/main.js');
}catch(e){fs.writeFileSync(path.join(root,'startup-error.log'),String(e.stack));app.whenReady().then(()=>{dialog.showErrorBox('Agent 启动失败',e.message);app.quit();});}
