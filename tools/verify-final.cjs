/* 复核 10 桌最终落位：3D 障碍 + 航拍路面/建筑（Python 侧另查），此处查 3D 碰撞 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fin-'));
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
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.banquet'))break;await sleep(100);}

  const rep=await evaluate(`(()=>{
    const {scene}=window.modelDebug,T=THREE;
    scene.updateMatrixWorld(true);
    const solids=[];scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
    const banq=window.banquet.group;
    const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
    const CANDS=[[10.5,17],[11,16.5],[12,16.5],[10,18]];
    const extra=CANDS.map(([x,z])=>{
      const bad=[];
      for(let a=0;a<16;a++){const ang=a/16*Math.PI*2;
        for(const rr of [1.4,1.0]){
          ray.set(new T.Vector3(x+Math.cos(ang)*rr,60,z+Math.sin(ang)*rr),new T.Vector3(0,-1,0));
          const h=ray.intersectObjects(solids,false)[0];
          if(!h)continue;
          let p=h.object,own=false;while(p){if(p===banq)own=true;p=p.parent;}
          if(!own&&h.point.y>1.6){let q=h.object,nm='';while(q&&!nm){nm=q.name;q=q.parent;}bad.push(nm||'?');}
        }}
      return '候选('+x+','+z+'): '+(bad.length?[...new Set(bad)].join(','):'OK');
    }).join('\\n');
    return extra + '\\n--- 已落位 ---\\n' + window.banquet.group.children.map((g,i)=>{
      const x=g.position.x,z=g.position.z;
      const bad=[];
      for(let a=0;a<16;a++){
        const ang=a/16*Math.PI*2;
        for(const rr of [1.4,1.0]){
          ray.set(new T.Vector3(x+Math.cos(ang)*rr,60,z+Math.sin(ang)*rr),new T.Vector3(0,-1,0));
          const h=ray.intersectObjects(solids,false)[0];
          if(!h)continue;
          let p=h.object,own=false;while(p){if(p===banq)own=true;p=p.parent;}
          if(!own&&h.point.y>1.6){let q=h.object,nm='';while(q&&!nm){nm=q.name;q=q.parent;}bad.push(nm||'?');}
        }
      }
      return '桌'+(i+1)+' ('+x.toFixed(1)+','+z.toFixed(1)+'): '+(bad.length?[...new Set(bad)].join(','):'OK');
    }).join('\\n');
  })()`);
  console.log(rep);

  /* 俯视出图（配准航拍，可直接看出是否压路） */
  await evaluate(`(()=>{[...document.body.children].forEach(e=>{if(e.tagName!=='CANVAS')e.style.display='none';});
    const {scene}=window.modelDebug;if(scene.fog)scene.fog=null;
    const c=window.modelDebug.cam;c.fov=48;c.near=1;c.far=2000;c.aspect=1440/900;c.up.set(0,0,-1);
    c.position.set(6,110,16);c.lookAt(6,0,16);c.updateProjectionMatrix();window.modelDebug.request();})()`);
  await sleep(700);
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'layout-D.png'),Buffer.from(s.data,'base64'));
  /* 草坪区近景 */
  await evaluate(`(()=>{const c=window.modelDebug.cam;c.up.set(0,1,0);c.fov=46;c.updateProjectionMatrix();
    c.position.set(26,42,44);c.lookAt(13,0,20);window.modelDebug.request();})()`);
  await sleep(500);
  const s2=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,'layout-lawn.png'),Buffer.from(s2.data,'base64'));
  console.log('ERRORS:',JSON.stringify(pageErrors));
 }catch(err){console.log('FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
