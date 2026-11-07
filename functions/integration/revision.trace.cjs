// Instrumentación diagnóstica de SDK público; no cambia retornos, reintentos ni concurrencia.
const fs=require('node:fs'),path=require('node:path'),{Firestore}=require('firebase-admin/firestore');
const original=Firestore.prototype.runTransaction,rows=[],origin=process.hrtime.bigint();let counter=0;
const ms=()=>Number(process.hrtime.bigint()-origin)/1e6;
Firestore.prototype.runTransaction=function(callback,...options){
  const call={id:++counter,start_ms:ms(),site:(new Error()).stack.split('\n').filter(x=>x.includes('lib\\data\\repository')||x.includes('lib/data/repository')).slice(0,2),attempts:[]};rows.push(call);
  const wrapped=async tx=>{
    const attempt={start_ms:ms(),reads:[],writes:[]};call.attempts.push(attempt);
    const proxy=new Proxy(tx,{get(target,key){
      if(['get','getAll'].includes(key))return async(...args)=>{
        const read={method:key,paths:args.map(a=>a?.path??a?.constructor?.name??String(a)),start_ms:ms()};attempt.reads.push(read);
        try{const result=await target[key](...args);read.end_ms=ms();read.documents=(Array.isArray(result)?result:(result?.docs??[result])).map(d=>d?.ref?.path);return result;}catch(e){read.end_ms=ms();read.error={code:e.code,message:e.message};throw e;}
      };
      if(['set','update','create','delete'].includes(key))return(...args)=>{attempt.writes.push({method:key,path:args[0]?.path,at_ms:ms()});const result=target[key](...args);return result===target?proxy:result;};
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});
    try{return await callback(proxy);}finally{attempt.end_ms=ms();}
  };
  return original.call(this,wrapped,...options).then(value=>{call.end_ms=ms();call.status='fulfilled';return value;},error=>{call.end_ms=ms();call.status='rejected';call.error={code:error.code,message:error.message};throw error;});
};
process.on('exit',()=>{if(process.env.CAP10_EVIDENCE_DIR&&rows.length)fs.writeFileSync(path.join(process.env.CAP10_EVIDENCE_DIR,'trace.json'),JSON.stringify({unit:'ms monotonic',instrumentation:'public Firestore/Transaction methods, observational',rows},null,2));});
