/* 模型正俯视截图（与航拍同比例同范围），用于叠加对比 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'overlay-qa-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--window-size=1450,1090','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  if(!port)throw Error('Browser startup timed out');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){pending.get(x.id)?.(x);pending.delete(x.id);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,x=>x.error?reject(Error(JSON.stringify(x.error))):resolve(x.result));ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.modelDebug'))break;await sleep(100);}
  /* 等全部图层脚本（含写实层）执行完——写实层加载时会重新加雾，清雾必须在它之后 */
  for(let i=0;i<50;i++){if(await evaluate('document.readyState==="complete"'))break;await sleep(100);}
  await sleep(1000);
  /* 隐藏 UI 覆盖层：隐藏 canvas 以外的所有顶层元素 */
  await evaluate(`[...document.body.children].forEach(e=>{if(e.tagName!=='CANVAS')e.style.display='none';});'ok'`);
  /* 关雾效：直接把雾距离推到极远 */
  await evaluate(`(()=>{const sc=window.modelDebug.scene;if(sc&&sc.fog){sc.fog.near=1e5;sc.fog.far=1e6;}return 'fog='+(sc&&sc.fog?('near '+sc.fog.near):'none');})()`);
  /* 正俯视：y 轴向下看，屏幕上方 = -z（对应航拍 py 向下 = +z） */
  await evaluate(`(()=>{
    const c=window.modelDebug.cam;
    c.fov=10;c.near=1;c.far=2000;c.aspect=1440/1080;
    c.up.set(0,0,-1);
    c.position.set(0,440,0);
    c.lookAt(0,0,0);
    c.updateProjectionMatrix();
    window.modelDebug.request();return 'ok';})()`);
  await sleep(800);
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'model-topdown.png'),Buffer.from(s.data,'base64'));
  console.log('saved model-topdown.png');
 }catch(err){console.log('VERIFY_FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
