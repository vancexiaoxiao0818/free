/* 高清全景图：隐藏 UI，高空俯视整个场地，2560x1440 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const W=2560,H=1440;
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pano-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--window-size='+W+','+H,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  if(!port)throw Error('Browser startup timed out');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){pending.get(x.id)?.(x);pending.delete(x.id);}};
  const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,x=>x.error?rej(Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id,method:m,params:p}));});
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const errs=[];
  ws.addEventListener('message',e=>{const x=JSON.parse(e.data);
    if(x.method==='Runtime.exceptionThrown')errs.push('err');});

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await ev('!!window.ittDebug&&!!window.propsDebug'))break;await sleep(100);}
  await sleep(1500);

  /* 隐藏所有界面元素，只留三维画面 */
  await ev(`(()=>{const s=document.createElement('style');
    s.textContent='#rehearsal,#modebar,#touch-walk,#itt,header,footer,#hint,#legend{display:none!important}body{margin:0}canvas{display:block}';
    document.head.appendChild(s);})()`);
  await ev(`window.modelDebug.view('site')`);
  await sleep(500);

  /* 高空斜视全场：pitch 约 55°，距离 160m，看向场地中心 */
  await ev(`(()=>{
    const {cam,request}=window.modelDebug;
    const T=THREE,dist=160,pitch=55*Math.PI/180,yaw=Math.PI;
    const cxp=-2,czp=2;
    cam.up.set(0,1,0);
    cam.position.set(cxp+dist*Math.sin(yaw)*Math.cos(pitch),dist*Math.sin(pitch),czp-dist*Math.cos(yaw)*Math.cos(pitch));
    cam.lookAt(cxp,0,czp);
    if(cam.fov!==48){cam.fov=48;cam.updateProjectionMatrix();}
    request();})()`);
  await sleep(900);
  const s1=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'panorama.png'),Buffer.from(s1.data,'base64'));
  console.log('saved panorama.png ('+W+'x'+H+')');

  /* 补充：东南高位斜视（泳池区 → 婚礼篷房 → 主楼 → 路东建筑群一览） */
  await ev(`(()=>{const {cam,request}=window.modelDebug;cam.up.set(0,1,0);
    cam.fov=45;cam.updateProjectionMatrix();
    cam.position.set(80,60,90);cam.lookAt(-12,0,-2);request();})()`);
  await sleep(700);
  const s2=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'panorama-angle.png'),Buffer.from(s2.data,'base64'));
  console.log('saved panorama-angle.png');
  console.log('ERRORS:',JSON.stringify(errs));
 }catch(err){console.log('FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
