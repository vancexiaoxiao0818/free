/* 求解三套午宴布局的落点（各自独立求解，保证无冲突 + 桌间距 >=6.2m） */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const LAYOUTS={
 A:{name:'A 集中大草坪（3 排 4+3+3）',anchors:[
   [9,20],[15,20],[21,20],[27,20],
   [9,26.5],[15,26.5],[21,26.5],
   [9,33],[15,33],[21,33]]},
 B:{name:'B 分区联动（4+2+2+2，当前）',anchors:[
   [9.5,19],[15,23.5],[9.5,26.5],[15,30],
   [-19.5,-8.5],[-13,-8.5],
   [-9.5,8],[-3,7.5],[-11,29.5],[-4,29.5]]},
 C:{name:'C 仪式环绕（硬化地4+主楼东4+泳池2）',anchors:[
   [-12.5,-7.5],[-6,-7.5],
   [-11,7.5],[-4,7.5],[-4,13.5],
   [9.5,20],[17.5,19.5],[24,20],
   [-22,-16],[-16,-16]]}
};

/* 禁止落桌区域 [x0,x1,z0,z1,pad]：水面 pad 1.8（椅子不落水即可），舞台/椅阵 pad 2.9 */
const NOGO=[
 [-26.8,-22.0,-15.8,-9.4,1.8],   /* L 形泳池·西段 */
 [-22.2,-13.4,-14.7,-10.5,1.8],  /* L 形泳池·东段 */
 [-27.6,-19.4,-3.2,3.8,1.8],     /* 白架棚泳池 */
 [-14.3,-8.9,-2.6,2.6,2.9],      /* 婚礼舞台 */
 [-12.4,-7.1,-4.2,4.2,2.9]       /* 宾客椅阵 */
];

(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'solve3-'));
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

  /* 先把现有桌阵移出视野，避免求解时把自己算成障碍（按 group 排除已处理，故无需移动） */
  for(const key of Object.keys(LAYOUTS)){
    const anchors=LAYOUTS[key].anchors;
    const out=await evaluate(`(()=>{
      const {scene}=window.modelDebug,T=THREE;
      scene.updateMatrixWorld(true);
      const solids=[];scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.visible&&!o.name.includes('航拍'))solids.push(o);});
      const banq=window.banquet.group;
      const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
      const NOGO=${JSON.stringify(NOGO)};
      const R=2.9;
      /* 桌子含椅半径约 2.9m；禁止区外扩 2.8m 后，桌心不得落入 */
      function inNoGo(x,z){
        for(const r of NOGO){
          const pad=r[4];
          if(x>r[0]-pad&&x<r[1]+pad&&z>r[2]-pad&&z<r[3]+pad)return true;
        }
        return false;
      }
      function free(x,z,placed){
        if(inNoGo(x,z))return false;
        for(const p of placed){if(Math.hypot(p[0]-x,p[1]-z)<6.2)return false;}
        for(let a=0;a<16;a++){
          const ang=a/16*Math.PI*2;
          for(const rr of [R,R*.6]){
            ray.set(new T.Vector3(x+Math.cos(ang)*rr,60,z+Math.sin(ang)*rr),new T.Vector3(0,-1,0));
            const h=ray.intersectObjects(solids,false)[0];
            if(!h)continue;
            let p=h.object,own=false;while(p){if(p===banq)own=true;p=p.parent;}
            if(!own&&h.point.y>1.1)return false;
          }
        }
        return true;
      }
      const anchors=${JSON.stringify(anchors)};
      const placed=[],out=[];
      anchors.forEach((a,i)=>{
        let best=null;
        for(let r=0;r<=6&&!best;r+=0.5){
          for(let k=0;k<24;k++){
            const ang=k/24*Math.PI*2;
            const x=Math.round((a[0]+Math.cos(ang)*r)*2)/2,z=Math.round((a[1]+Math.sin(ang)*r)*2)/2;
            if(free(x,z,placed)){best={x,z,r};break;}
          }
        }
        if(!best){out.push('{id:'+(i+1)+',x:0,z:0} /* 无解 原锚点'+a[0]+','+a[1]+' */');return;}
        placed.push([best.x,best.z]);
        out.push('{id:'+(i+1)+',x:'+best.x+',z:'+best.z+'}'+(best.r>0.1?'  /* 偏移'+best.r.toFixed(1)+'m */':''));
      });
      return out.join('\\n      ');
    })()`);
    console.log('=== 方案 '+key+'：'+LAYOUTS[key].name+' ===');
    console.log('      '+out);
  }
 }catch(err){console.log('SOLVE_FAILED:',err.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
