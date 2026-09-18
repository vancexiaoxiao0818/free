/* 求解方案 D 泳池区 3 桌（⑩⑪⑫）的落点：从标记点螺旋外扩找无冲突位置 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'solveD-'));
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
    const NOGO=[
      [-26.8,-22.0,-15.8,-9.4,1.8],[-22.2,-13.4,-14.7,-10.5,1.8],[-27.6,-19.4,-3.2,3.8,1.8],
      [-14.3,-8.9,-2.6,2.6,2.9],[-12.4,-7.1,-4.2,4.2,2.9]];
    function inNoGo(x,z){
      for(const r of NOGO){const pad=r[4];
        if(x>r[0]-pad&&x<r[1]+pad&&z>r[2]-pad&&z<r[3]+pad)return true;}
      return false;}
    function free(x,z,placed){
      if(inNoGo(x,z))return false;
      for(const p of placed){if(Math.hypot(p[0]-x,p[1]-z)<5.8)return false;}
      for(let a=0;a<16;a++){
        const ang=a/16*Math.PI*2;
        for(const rr of [2.9,1.74]){
          ray.set(new T.Vector3(x+Math.cos(ang)*rr,60,z+Math.sin(ang)*rr),new T.Vector3(0,-1,0));
          const h=ray.intersectObjects(solids,false)[0];
          if(!h)continue;
          let p=h.object,own=false;while(p){if(p===banq)own=true;p=p.parent;}
          if(!own&&h.point.y>1.1)return false;
        }
      }
      return true;}
    const anchors=[[19,12],[25,17],[19,22.5]];
    const placed=[[13.5,17.5],[10.5,12],[2.5,12]]; /* 已定的 ②③④ */
    const out=[];
    for(const a of anchors){
      let best=null;
      for(let r=0;r<=8&&!best;r+=0.5){
        for(let k=0;k<32;k++){
          const ang=k/32*Math.PI*2;
          const x=Math.round((a[0]+Math.cos(ang)*r)*2)/2,z=Math.round((a[1]+Math.sin(ang)*r)*2)/2;
          if(free(x,z,placed)){best={x,z,r};break;}
        }
      }
      if(best){placed.push([best.x,best.z]);
        out.push('('+best.x+','+best.z+')  偏移'+best.r.toFixed(1)+'m');}
      else out.push('无解');
    }
    return out.join('\\n');
  })()`);
  const lines=out.split('\n');
  lines.forEach((l,i)=>console.log('D'+(i+1)+':',l));
 }catch(err){console.log('FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
