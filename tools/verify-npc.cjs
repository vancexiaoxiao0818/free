/* 验证：拆除篷房 + 人流层 NPC 走动 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'npc-qa-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--window-size=1440,900','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  if(!port)throw Error('Browser startup timed out');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){pending.get(x.id)?.(x);pending.delete(x.id);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,x=>x.error?reject(Error(JSON.stringify(x.error))):resolve(x.result));ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const pageErrors=[];
  ws.addEventListener('message',e=>{const x=JSON.parse(e.data);
    if(x.method==='Runtime.exceptionThrown')pageErrors.push(x.params.exceptionDetails?.exception?.description||'unknown');});
  const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(__dirname,name),Buffer.from(s.data,'base64'));return name;};
  const look=(ex,ey,ez,tx,ty,tz)=>evaluate(`(()=>{const c=window.modelDebug.cam;c.up.set(0,1,0);
    c.position.set(${ex},${ey},${ez});c.lookAt(${tx},${ty},${tz});window.modelDebug.request();})()`);

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.npcFlow'))break;await sleep(100);}

  /* 等待 NPC 走动几秒，记录前后位置对比验证动画 */
  const p0=await evaluate(`JSON.stringify(window.npcFlow.walkers.map(w=>[w.g.position.x.toFixed(2),w.g.position.z.toFixed(2)]))`);
  await sleep(3000);
  const p1=await evaluate(`JSON.stringify(window.npcFlow.walkers.map(w=>[w.g.position.x.toFixed(2),w.g.position.z.toFixed(2)]))`);
  const info=await evaluate(`JSON.stringify({n:window.npcFlow.walkers.length,labels:window.npcFlow.walkers.map(w=>w.label)})`);

  /* 婚礼现场俯视（确认篷房已拆、舞台/椅阵无遮挡） */
  await look(-9.5,26,4,-9.5,0,.5);await sleep(600);
  await shot('wedding-open-top.png');
  /* 婚礼现场斜视（舞台+花墙+家长走动） */
  await look(2,12,16,-11.5,1.5,0);await sleep(500);
  await shot('wedding-open-close.png');
  /* 迎亲路线（车道） */
  await look(6,14,-34,-5,0,-12);await sleep(500);
  await shot('npc-procession.png');

  console.log('===== NPC REPORT =====');
  console.log('info:',info);
  console.log('pos t0:',p0);
  console.log('pos t+3s:',p1);
  console.log(JSON.stringify({pageErrors},null,2));
  console.log('===== END =====');
 }catch(err){console.log('VERIFY_FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
