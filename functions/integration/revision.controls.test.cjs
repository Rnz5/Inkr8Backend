const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(127\.0\.0\.1|localhost):\d+$/);
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-inkr8'},'revision-control'),db=getFirestore(app);
const mode=process.env.CAP10_CONTROL_MODE||'independent';
before(async()=>{
  const host=process.env.FIRESTORE_EMULATOR_HOST;
  const response=await fetch(`http://${host}/emulator/v1/projects/demo-inkr8/databases/(default)/documents`,{method:'DELETE'});assert.equal(response.status,200);
  const batch=db.batch();for(let i=0;i<50;i++)batch.set(db.doc(`control/x${i}`),{value:0,status:'PENDING'});
  batch.set(db.doc('control/shared'),{value:0});batch.set(db.doc('seasons/s0'),{id:'s0'});await batch.commit();
});
after(async()=>{await db.terminate();await deleteApp(app);});
test('REV-CTRL-01 cincuenta transacciones controladas sin cambiar el paralelismo',{timeout:240000},async()=>{
  const rows=[],origin=process.hrtime.bigint(),ms=()=>Number(process.hrtime.bigint()-origin)/1e6;
  await Promise.all(Array.from({length:50},(_,i)=>(async()=>{
    const row={id:i,start_ms:ms(),attempts:0};rows.push(row);
    try{
      await db.runTransaction(async tx=>{
        row.attempts++;
        if(mode==='shared-counter'){
          const ref=db.doc('control/shared'),doc=await tx.get(ref);tx.update(ref,{value:doc.get('value')+1});
        }else if(mode==='pairs' || mode==='ordered-pairs'){
          const partner=i%2?i-1:i+1,refs=[db.doc(`control/x${i}`),db.doc(`control/x${partner}`)];
          if(mode==='ordered-pairs')refs.sort((a,b)=>a.path.localeCompare(b.path));
          const docs=await tx.getAll(...refs);if(docs.every(d=>d.get('status')==='PENDING'))for(const ref of refs)tx.update(ref,{status:'MATCHED'});
        }else{
          const ref=db.doc(`control/x${i}`),doc=await tx.get(ref);tx.update(ref,{value:doc.get('value')+1});
          if(mode==='shared-season')tx.set(db.doc('seasons/s0'),{id:'s0'},{merge:true});
        }
      });row.result='fulfilled';
    }catch(e){row.result='rejected';row.error={code:e.code,message:e.message};}finally{row.end_ms=ms();}
  })()));
  let active=0,peak=0;for(const [,d] of rows.flatMap(r=>[[r.start_ms,1],[r.end_ms,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])){active+=d;peak=Math.max(peak,active);}
  const docs=(await db.collection('control').get()).docs.map(d=>({id:d.id,...d.data()}));
  const report={mode,attempted:50,fulfilled:rows.filter(r=>r.result==='fulfilled').length,peak,rows,docs};
  if(process.env.CAP10_EVIDENCE_DIR)fs.writeFileSync(path.join(process.env.CAP10_EVIDENCE_DIR,`control-${mode}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));assert.equal(peak,50);assert.equal(report.fulfilled,50);
  if(mode==='shared-counter')assert.equal(docs.find(d=>d.id==='shared').value,50);
  else if(mode.endsWith('pairs'))assert.equal(docs.filter(d=>d.status==='MATCHED').length,50);
  else assert.equal(docs.filter(d=>d.id!=='shared'&&d.value===1).length,50);
});
