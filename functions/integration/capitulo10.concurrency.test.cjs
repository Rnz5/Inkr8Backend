const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '',/^(127\.0\.0\.1|localhost):\d+$/,'Only local emulator');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {FirebaseUserRepository}=require('../lib/data/repository/firebaseUserRepository');
const {FirebaseGameRepository}=require('../lib/data/repository/firebaseGameRepository');
const {FirebaseContentRepository}=require('../lib/data/repository/firebaseContentRepository');
const {FirebaseMatchRepository}=require('../lib/data/repository/firebaseMatchRepository');
const {EvaluateGame}=require('../lib/domain/usecase/gameUseCases');
const {EvaluationTimeout}=require('../lib/domain/model/models');
const {seasonAt,SEASON_ANCHOR_MS}=require('../lib/domain/policy/seasonPolicy');
const app=initializeApp({projectId:'demo-inkr8'},'capitulo10'),db=getFirestore(app);
let env,now=SEASON_ANCHOR_MS;const clock={now:()=>now},season=()=>seasonAt(now);
const users=new FirebaseUserRepository(db,clock),games=new FirebaseGameRepository(db,clock),matches=new FirebaseMatchRepository(db,clock);
const text=n=>Array(n).fill('ink').join(' ');
const challenge={words:['ink','tree','life','word'].map(text=>({text,definition:'Definition',sentence:'A sentence.'})),topic:null,theme:null};
function evidence(name,value){if(process.env.CAP10_EVIDENCE_DIR)fs.writeFileSync(path.join(process.env.CAP10_EVIDENCE_DIR,name+'.json'),JSON.stringify(value,null,2));console.log(name+' '+JSON.stringify(value));}
before(async()=>{const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');env=await initializeTestEnvironment({projectId:'demo-inkr8',firestore:{host,port:Number(port),rules:fs.readFileSync(path.resolve(__dirname,'../../firestore.rules'),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();now=SEASON_ANCHOR_MS;});
after(async()=>{await env.cleanup();await db.terminate();await deleteApp(app);});
async function draft(id='g',uid='alice',mode='RANKED',writingMode='STANDARD',c=challenge,t=now){await users.initialize(uid,uid,null,season());return games.start(id,uid,mode,writingMode,c,season(),t);}
async function pending(id='g',uid='alice',mode='RANKED',count=50){await draft(id,uid,mode);await games.submit(id,uid,text(count));return games.get(id);}

test('AC03-C01 cincuenta solicitudes de matching con solapamiento medido y cola compartida',{timeout:240000},async()=>{
  // Preparación fuera de la ventana; un usuario y puntuación únicos por partida.
  for(let i=0;i<50;i++){
    const uid=`u${i}`,id=`m${i}`;await users.initialize(uid,`Player${i}`,null,season());await db.doc(`users/${uid}`).update({rating:100,league:4});
    const game=await pending(id,uid);await games.complete(game,{score:20+i,feedback:`Fixture ${i}`},season());
  }
  const samples=[],origin=process.hrtime.bigint(),wallStart=new Date().toISOString();
  const elapsed=()=>Number(process.hrtime.bigint()-origin)/1e6;
  await Promise.all(Array.from({length:50},(_,i)=>(async()=>{
    const sample={id:`m${i}`,start_ms:elapsed()};samples.push(sample);
    try{await matches.match(sample.id,season());sample.status='fulfilled';}catch(e){sample.status='rejected';sample.error={code:e.code,message:e.message};}finally{sample.end_ms=elapsed();}
  })()));
  const events=samples.flatMap(s=>[[s.start_ms,1],[s.end_ms,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,peak=0;for(const [,d]of events){active+=d;peak=Math.max(peak,active);}
  const final=[];for(let i=0;i<50;i++)final.push({id:`m${i}`,uid:`u${i}`,initialRating:100,user:(await db.doc(`users/u${i}`).get()).data(),game:(await db.doc(`submissions/m${i}`).get()).data()});
  const report={project:'demo-inkr8',host:process.env.FIRESTORE_EMULATOR_HOST,wallStart,unit:'ms monotonic',preparationOutsideWindow:true,warmup:0,attempted:50,completed:samples.filter(s=>s.status==='fulfilled').length,peakActiveOperations:peak,samples,final};evidence('AC03_50_solicitudes',report);
  const partners=new Set(),violations=[];
  for(const f of final.filter(f=>f.game.matchStatus==='MATCHED')){
    const opponent=final.find(other=>other.user.name===f.game.match?.opponentName);
    if(!opponent || opponent.uid===f.uid || opponent.game.match?.opponentName!==f.user.name) {violations.push({id:f.id,type:'non-reciprocal'});continue;}
    if(f.game.match.opponentScore!==opponent.game.evaluation.score || Math.abs(f.initialRating-opponent.initialRating)>30)violations.push({id:f.id,type:'opponent-or-delta'});
    if(f.user.rating!==100+f.game.match.ratingChange || f.game.match.outcome!==(f.game.evaluation.score>opponent.game.evaluation.score?'WIN':'LOSS'))violations.push({id:f.id,type:'rating-or-outcome'});
    partners.add([f.id,opponent.id].sort().join('/'));
  }
  report.verifiedPairs=partners.size;report.matched=final.filter(f=>f.game.matchStatus==='MATCHED').length;report.violations=violations;
  report.scope='Invariantes de parejas resueltas; completar 50 sin errores es un objetivo adicional de disponibilidad, no un umbral de latencia cloud';evidence('AC03_50_solicitudes',report);
  assert.equal(peak,50);assert.deepEqual(violations,[]);assert.equal(report.completed,50,'50 requests overlapped, but not all completed without errors');
  assert.equal(report.matched,50);assert.equal(partners.size,25);
});
