/* 裁切航拍原图指定区域并放大，用于核对地面物体 */
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const AREAS=[
 ['F-east',1180,320,460,600],      /* F. 路东建筑群（全） */
 ['G-north',1230,110,320,240],     /* G. 北面远处小屋 */
 ['H-farm',420,1040,310,230]       /* H. 左下菜地/梯田区 */
];
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'crop-'));
 const proc=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  let port;for(let i=0;i<80;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await sleep(100);}
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.id){pending.get(x.id)?.(x);pending.delete(x.id);}};
  const send=(m,p={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,x=>x.error?rej(Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id,method:m,params:p}));});
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');
  const b64=fs.readFileSync(path.join(__dirname,'site-aerial-original.jpg')).toString('base64');
  for(const [name,x,y,w,h] of AREAS){
    const out=await ev(`(async()=>{
      const img=new Image();
      await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej('loadfail');img.src='data:image/jpeg;base64,${b64}';});
      const S=3,c=document.createElement('canvas');
      c.width=${w}*S;c.height=${h}*S;
      const x2=c.getContext('2d');
      x2.imageSmoothingEnabled=true;x2.imageSmoothingQuality='high';
      x2.drawImage(img,${x},${y},${w},${h},0,0,c.width,c.height);
      /* 画十字与边框，便于定位 */
      x2.strokeStyle='#ff3b30';x2.lineWidth=3;
      x2.strokeRect(2,2,c.width-4,c.height-4);
      return c.toDataURL('image/png');
    })()`);
    const data=out.split(',')[1];
    fs.writeFileSync(path.join(__dirname,'crop-'+name+'.png'),Buffer.from(data,'base64'));
    console.log('saved crop-'+name+'.png  (src '+x+','+y+' '+w+'x'+h+' -> '+(w*3)+'x'+(h*3)+')');
  }
 }catch(e){console.log('FAILED:',e.message);}
 finally{try{ws&&ws.close();}catch{}try{proc.kill();}catch{}setTimeout(()=>process.exit(0),300);}
})();
