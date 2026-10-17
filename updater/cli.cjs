const path=require('node:path'),core=require('./core.cjs');
async function run(root,action){
 const ctx=core.context(root),engine=ctx.state.active.host?.package.updaterVersion?path.join(ctx.host,'updater-engine'):path.join(root,'updater');
 if(path.resolve(engine)!==path.resolve(__dirname))return require(path.join(engine,'cli.cjs')).run(root,action);
 if(action==='status'){const c=ctx.config,s=ctx.state;return {productId:c.productId,hostVersion:s.active.host?.version||c.hostVersion,productVersion:s.active.product?.version||c.productVersion,instanceId:c.instanceId,repository:c.repository,channel:c.channel,configured:Object.keys(c.trustedKeys).length>0,active:s.active,pending:s.pending||{},history:s.history};}
 if(action==='credential-location')return {path:require('./github.cjs').credentialFile(root)};
 if(action==='check')return require('./github.cjs').check(root);
 if(action==='download'){const api=require('./github.cjs');return api.download(root,await api.check(root));}
 if(action==='activate')return core.activate(root);
 if(action==='rollback')return core.rollback(root);
 throw Error('Supported: status, check, download, activate, rollback');
}
if(require.main===module)run(path.resolve(process.env.UAH_AGENT_ROOT||path.resolve(__dirname,'..')),process.argv[2]||'status').then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
