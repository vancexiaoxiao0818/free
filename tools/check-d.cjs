/* 复检方案 D 泳池区最终两点 + 天台 4 桌落位检查 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'chkD-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--window-size=1440,900','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){pending.get(x.id)?.(x);pending.delete(x.id);}};
  const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,x=>x.error?rej(Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id,method:m,params:p}));});
  const evaluate=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.banquet'))break;await sleep(100);}
  const out=await evaluate(`(()=>{
    const {scene}=window.modelDebug,T=THREE;
    scene.updateMatrixWorld(true);
    const solids=[];scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
    const banq=window.banquet.group;
    const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
    const pts={'⑩西侧池边':[-29.5,1.5],'⑫候选A':[-16.5,4],'⑫候选B':[-16,6],'⑫候选C':[-17.5,5.5],
      '天台⑤':[3.3,18.4],'天台⑥':[3.3,21.5],'天台⑦':[3.3,24.6],'天台⑧':[3.3,27.7]};
    const res=[];
    for(const [k,[tx,tz]] of Object.entries(pts)){
      const bad=[];
      for(let a=0;a<16;a++){
        const ang=a/16*Math.PI*2;
        const x=tx+Math.cos(ang)*2.9,z=tz+Math.sin(ang)*2.9;
        ray.set(new T.Vector3(x,60,z),new T.Vector3(0,-1,0));
        const h=ray.intersectObjects(solids,false)[0];
        if(!h)continue;
        let p=h.object,own=false;while(p){if(p===banq)own=true;p=p.parent;}
        if(!own&&h.point.y>1.15){
          let q=h.object,nm='';while(q&&!nm){nm=q.name;q=q.parent;}
          bad.push((nm||h.object.type)+'@'+h.point.y.toFixed(1));
        }
      }
      res.push(k+' ('+tx+','+tz+'): '+(bad.length?[...new Set(bad)].join(','):'OK'));
    }
    return res.join('\\n');
  })()`);
  console.log(out);
 }catch(err){console.log('FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
