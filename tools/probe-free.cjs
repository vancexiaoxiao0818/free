/* 探测：在主楼东侧/南侧草坪按网格射线向下探测，找出没有建筑/道具的空格 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'probe-'));
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
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,'venue-walkthrough-3d.html')).href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.npcFlow'))break;await sleep(100);}

  const probe=await evaluate(`(()=>{
    const {scene}=window.modelDebug,T=THREE;
    scene.updateMatrixWorld(true);
    const solids=[];
    scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
    const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
    const out=[];
    for(let x=-2;x<=16;x+=1){
      let row='';
      for(let z=12;z<=30;z+=1){
        ray.set(new T.Vector3(x,60,z),new T.Vector3(0,-1,0));
        const hits=ray.intersectObjects(solids,false);
        let ch='.';
        if(hits.length){
          const h=hits[0];
          /* 只把高于 1.2m 的实体视为障碍（建筑/车/树/桌椅），地面/草坪/道路算空格 */
          if(h.point.y>1.2)ch='#'; else if(h.point.y>0.4)ch='o';
        }
        row+=ch;
      }
      out.push('x='+String(x).padStart(3)+' '+row);
    }
    return out.join('\\n');
  })()`);
  const names=await evaluate(`(()=>{
    const {scene}=window.modelDebug,T=THREE;
    scene.updateMatrixWorld(true);
    const solids=[];scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
    const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
    const pts=[[3,22],[5,26],[10,20],[12,24],[0,20],[9,18],[-2,13]];
    return pts.map(([x,z])=>{
      ray.set(new T.Vector3(x,60,z),new T.Vector3(0,-1,0));
      const h=ray.intersectObjects(solids,false)[0];
      if(!h)return x+','+z+' -> 空';
      let p=h.object,nm=[];while(p&&nm.length<3){if(p.name)nm.push(p.name);p=p.parent;}
      return x+','+z+' -> y='+h.point.y.toFixed(2)+' | '+(nm.join(' / ')||h.object.type);
    }).join('\\n');
  })()`);
  const grid=async(x0,x1,z0,z1,sx=1,sz=1)=>evaluate(`(()=>{
    const {scene}=window.modelDebug,T=THREE;
    scene.updateMatrixWorld(true);
    const solids=[];scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
    const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
    const out=[];
    for(let z=${z0};z<=${z1};z+=${sz}){
      let row='';
      for(let x=${x0};x<=${x1};x+=${sx}){
        ray.set(new T.Vector3(x,60,z),new T.Vector3(0,-1,0));
        const h=ray.intersectObjects(solids,false)[0];
        let ch='.';
        if(h){if(h.point.y>1.2)ch='#';else if(h.point.y>0.4)ch='o';}
        row+=ch;
      }
      out.push('z='+String(z).padStart(4)+' '+row);
    }
    return out.join('\\n');
  })()`);
  const hdr=(x0,n,st)=>Array.from({length:n},(_,i)=>Math.abs((x0+i*st)%10)).join('');
  console.log('=== 全场粗扫 (x -30..34 步3, z -20..38 步2) : # 障碍 / o 低物 / . 空地 ===');
  console.log('        x: '+hdr(-30,22,3));
  console.log(await grid(-30,34,-20,38,3,2));
 }catch(err){console.log('PROBE_FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
