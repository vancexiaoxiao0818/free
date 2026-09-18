/* 验证：午宴 10 桌落位（俯视 + 分区近景），检查是否压到建筑/道具 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'banq-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--window-size=1440,900','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  if(!port)throw Error('Browser startup timed out');
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
  const look=(ex,ey,ez,tx,ty,tz)=>evaluate(`(()=>{const c=window.modelDebug.cam;c.up.set(0,1,0);
    c.fov=48;c.updateProjectionMatrix();
    c.position.set(${ex},${ey},${ez});c.lookAt(${tx},${ty},${tz});window.modelDebug.request();})()`);

  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.banquet'))break;await sleep(100);}

  /* 每桌周边 3m 半径内是否有非本桌的障碍 */
  const clash=await evaluate(`(()=>{
    const {scene}=window.modelDebug,T=THREE;
    scene.updateMatrixWorld(true);
    const solids=[];scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
    const banq=window.banquet.group;
    const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
    return window.banquet.tables.map(t=>{
      const bad=[];
      for(let a=0;a<12;a++){
        const ang=a/12*Math.PI*2;
        const x=t.x+Math.cos(ang)*2.9,z=t.z+Math.sin(ang)*2.9;
        ray.set(new T.Vector3(x,60,z),new T.Vector3(0,-1,0));
        const h=ray.intersectObjects(solids,false)[0];
        if(!h)continue;
        let p=h.object,own=false;while(p){if(p===banq)own=true;p=p.parent;}
        if(!own&&h.point.y>1.2){
          let q=h.object,nm='';while(q&&!nm){nm=q.name;q=q.parent;}
          bad.push(nm||h.object.type);
        }
      }
      return '桌'+t.id+' ('+t.x+','+t.z+') '+(bad.length?'冲突: '+[...new Set(bad)].join(','):'OK');
    }).join('\\n');
  })()`);
  console.log('--- 桌位冲突检查 ---');
  console.log(clash);

  /* 主宴席区俯视 */
  await look(11,34,52,11,0,22);await sleep(600);
  await shot('banquet-feast.png');
  /* 硬化地 4 桌 + 婚礼现场 */
  await look(-7,30,26,-9,0,9);await sleep(500);
  await shot('banquet-lot.png');
  /* 泳池边 2 桌 */
  await look(-17,30,2,-19,0,-9);await sleep(500);
  await shot('banquet-pool.png');
  /* 全场俯视（配准航拍） */
  await evaluate(`window.modelDebug.view('top')`);await sleep(800);
  await shot('banquet-top.png');

  console.log('ERRORS:',JSON.stringify(pageErrors));
 }catch(err){console.log('VERIFY_FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
