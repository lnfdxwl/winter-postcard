'use strict';
const statusLine=document.querySelector('#status');
const decoder=new TextDecoder(), assets=new Map(), textFiles=new Map(), pending=new Map(), ready=new Set();
let accessKey, frame;
const meter=document.querySelector('#meter'), bar=document.querySelector('#bar'), percent=document.querySelector('#percent');
function stageLabel(message){
 statusLine.textContent=message;meter.hidden=false;bar.removeAttribute('value');percent.textContent='';
}
function progressValue(n){bar.value=n;percent.textContent=n+'%'}
function stopLoader(message){
 document.body.classList.add('still');meter.hidden=true;statusLine.textContent=message;
}
window.cardURL=name=>{
 if(!assets.has(name))throw new Error('Missing resource');
 return assets.get(name);
};
async function bundle(id,progress){
 const response=await fetch(id+'.bin?v='+(id==='cover'?'4':'2'),{referrerPolicy:'no-referrer'});
 if(!response.ok)throw new Error('Download failed');
 const total=Number(response.headers.get('content-length'));
 let data;
 if(progress && response.body && total){
  const reader=response.body.getReader(),parts=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);bytes+=value.length;progress(Math.min(99,Math.round(100*bytes/total)))}
  data=new Uint8Array(await new Blob(parts).arrayBuffer());
 } else data=new Uint8Array(await response.arrayBuffer());
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:data.subarray(0,12),additionalData:new TextEncoder().encode(id)},accessKey,data.subarray(12));
 let offset=4+new DataView(plain).getUint32(0);
 const files=JSON.parse(decoder.decode(new Uint8Array(plain,4,offset-4)));
 for(const [name,size,type] of files){
  const content=new Uint8Array(plain,offset,size);
  if(type==='text/plain')textFiles.set(name,decoder.decode(content));
  else assets.set(name,URL.createObjectURL(new Blob([content],{type})));
  offset+=size;
 }
}
window.isReady=i=>ready.has(i);
window.prepareRound=(i,progress)=>{
 if(!pending.has(i)){
  const first=Boolean(frame?.hidden);
  if(first)stageLabel('正在装入照片和音乐…');
  pending.set(i,bundle('reel'+i,n=>{progress?.(n);if(first)progressValue(n)}).then(()=>{
   ready.add(i);
   if(first){frame.hidden=false;document.querySelector('main').hidden=true}
  }).catch(err=>{
   pending.delete(i);if(first)stopLoader('相册加载中断，请刷新重试。');throw err
  }));
 }
 return pending.get(i);
};
async function openCard(){
 const key=new URLSearchParams(location.hash.slice(1)).get('k');
 if(!key||!/^[A-Za-z0-9_-]{43}$/.test(key)){
  stopLoader('请使用收到的完整贺卡链接打开。');return;
 }
 try{
  const raw=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  accessKey=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  stageLabel('正在拆开信封…');await bundle('cover',progressValue);
  const css=textFiles.get('style').replace(/url\((art\/[^)]+)\)/g,(_,name)=>'url('+cardURL(name)+')');
  const jsBlob=URL.createObjectURL(new Blob([textFiles.get('script')],{type:'text/javascript'}));
  frame=document.createElement('iframe');frame.hidden=true;frame.title='圣诞贺卡';frame.allow='autoplay';
  frame.srcdoc=textFiles.get('layout').replace('src="media/p27.jpg"','src="'+cardURL('media/p27.jpg')+'"')
   .replace('<!--styles-->',()=>'<style>'+css+'</style>').replace('<!--code-->',()=>'<script src="'+jsBlob+'"></script>');
  document.body.append(frame);
 }catch{stopLoader('暂时无法打开，请检查网络并重新打开完整链接。')}
}
openCard();
