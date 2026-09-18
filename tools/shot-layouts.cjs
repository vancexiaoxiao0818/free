/* 生成三套午宴布局的俯视对比图（同一机位，配准航拍地皮） */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cmp3-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--window-size=1440,900','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){pending.get(x.id)?.(x);pending.delete(x.id);}};
  const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,x=>x.error?rej(Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id,method:m,params:p}));});
  const evaluate=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const pageErrors=[];
  ws.addEventListener('message',e=>{const x=JSON.parse(e.data);
    if(x.method==='Runtime.exceptionThrown')pageErrors.push(x.params.exceptionDetails?.exception?.description||'unknown');});
  const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(__dirname,name),Buffer.from(s.data,'base64'));return name;};

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.banquet&&window.banquet.apply'))break;await sleep(100);}

  /* 隐藏 UI，只留画布；统一机位（正俯视，配准航拍） */
  await evaluate(`(()=>{[...document.body.children].forEach(e=>{if(e.tagName!=='CANVAS')e.style.display='none';});
    const {scene}=window.modelDebug;if(scene.fog)scene.fog=null;
    const c=window.modelDebug.cam;c.fov=48;c.near=1;c.far=2000;c.aspect=1440/900;c.up.set(0,0,-1);
    c.position.set(2,120,10);c.lookAt(2,0,10);c.updateProjectionMatrix();return 1;})()`);
  await sleep(600);

  for(const k of ['D','A','B','C']){
    await evaluate(`window.banquet.apply('${k}')`);
    await sleep(500);
    await shot(`layout-${k}.png`);
    const info=await evaluate(`JSON.stringify({layout:window.banquet.current,pos:window.banquet.group.children.map(g=>[+g.position.x.toFixed(1),+g.position.z.toFixed(1),+g.position.y.toFixed(2)])})`);
    console.log(k+': '+info);
  }
  /* 恢复默认布局 D */
  await evaluate(`window.banquet.apply('D')`);
  /* 补一张天台斜视近景 */
  await evaluate(`(()=>{[...document.body.children].forEach(e=>{if(e.tagName!=='CANVAS')e.style.display='none';});
    const c=window.modelDebug.cam;c.up.set(0,1,0);c.fov=48;
    c.position.set(20,14,4);c.lookAt(3.3,3.6,23);window.modelDebug.request();})()`);
  await sleep(500);
  await shot('layout-terrace.png');
  console.log('ERRORS:',JSON.stringify(pageErrors));
 }catch(err){console.log('FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
