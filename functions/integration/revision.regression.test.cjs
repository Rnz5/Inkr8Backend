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

async function ready(id,uid,score=80,writingMode='STANDARD'){
  await draft(id,uid,'RANKED',writingMode,writingMode==='STANDARD'?challenge:{...challenge,words:challenge.words.slice(0,2),topic:'Nature'});
  await games.submit(id,uid,text(50));await games.complete(await games.get(id),{score,feedback:'Fixture vÃ¡lido'},season());
}
async function rating(uid,value,numericLeague){const batch=db.batch();batch.update(db.doc(`users/${uid}`),{rating:value,league:numericLeague});batch.set(db.doc(`seasons/s0/members/${uid}`),{rating:value,league:numericLeague},{merge:true});await batch.commit();}
test('REV-MATCH-01 delta 31 no empareja ni altera usuarios',async()=>{
  await ready('a','alice');await ready('b','bob',60);await rating('alice',100,4);await rating('bob',131,5);
  const balances=[(await db.doc('users/alice').get()).get('merit'),(await db.doc('users/bob').get()).get('merit')];
  await matches.match('a',season());assert.equal((await db.doc('submissions/a').get()).get('matchStatus'),'PENDING');assert.equal((await db.doc('submissions/b').get()).get('matchStatus'),'PENDING');
  assert.equal((await db.doc('users/alice').get()).get('rating'),100);assert.equal((await db.doc('users/bob').get()).get('rating'),131);
  assert.deepEqual([(await db.doc('users/alice').get()).get('merit'),(await db.doc('users/bob').get()).get('merit')],balances);
});
test('REV-MATCH-02 delta 30 inclusivo conserva pareja y resultados recÃ­procos',async()=>{
  await ready('a','alice');await ready('b','bob',60);await rating('alice',100,4);await rating('bob',130,5);
  await matches.match('a',season());const a=(await db.doc('submissions/a').get()).data(),b=(await db.doc('submissions/b').get()).data();
  assert.equal(a.matchStatus,'MATCHED');assert.equal(b.matchStatus,'MATCHED');assert.equal(a.match.opponentName,'bob');assert.equal(b.match.opponentName,'alice');
  assert.equal(a.match.outcome,'WIN');assert.equal(b.match.outcome,'LOSS');assert.equal(a.match.opponentScore,60);assert.equal(b.match.opponentScore,80);
});
test('REV-MATCH-03 un timestamp antiguo conserva prioridad frente a empate reciente',async()=>{
  now+=2;await ready('own','own',80);await ready('old','old',60);await ready('new','new',70);
  await db.doc('submissions/old').update({timestamp:SEASON_ANCHOR_MS});await matches.match('own',season());
  assert.equal((await db.doc('submissions/own').get()).get('match').opponentName,'old');assert.equal((await db.doc('submissions/new').get()).get('matchStatus'),'PENDING');
});
test('REV-MATCH-04 mismo autor no se empareja consigo mismo',async()=>{
  await ready('a','alice');await ready('b','alice',60);const balance=(await db.doc('users/alice').get()).get('merit');
  await matches.match('a',season());assert.equal((await db.doc('submissions/a').get()).get('matchStatus'),'PENDING');assert.equal((await db.doc('submissions/b').get()).get('matchStatus'),'PENDING');
  assert.equal((await db.doc('users/alice').get()).get('merit'),balance);
});
test('REV-MATCH-05 modos de escritura incompatibles no forman pareja',async()=>{
  await ready('a','alice');await ready('b','bob',60,'ON_TOPIC');await matches.match('a',season());
  assert.equal((await db.doc('submissions/a').get()).get('matchStatus'),'PENDING');assert.equal((await db.doc('submissions/b').get()).get('matchStatus'),'PENDING');
});
test('REV-MATCH-06 cuenta cerrada no recibe emparejamiento ni rating',async()=>{
  await ready('a','alice');await ready('b','bob',60);await db.doc('users/bob').update({accountClosed:true});await matches.match('a',season());
  assert.equal((await db.doc('submissions/a').get()).get('matchStatus'),'PENDING');assert.equal((await db.doc('submissions/b').get()).get('matchStatus'),'PENDING');assert.equal((await db.doc('users/bob').get()).get('rating'),0);
});
test('REV-MATCH-07 a las 48h usa promedio histÃ³rico 70 de 60 y 80, no constante 80',async()=>{
  await ready('past','alice',60);await db.doc('submissions/past').update({matchStatus:'MATCHED',match:{opponentName:'Fixture histÃ³rico',opponentScore:60,outcome:'DRAW',ratingChange:0}});
  await ready('current','alice',80);now+=48*60*60*1000;await matches.match('current',season());const settled=(await db.doc('submissions/current').get()).data();
  assert.equal(settled.matchStatus,'MATCHED');assert.equal(settled.match.opponentScore,70);assert.equal(settled.match.outcome,'WIN');const after=(await db.doc('users/alice').get()).get('rating');
  await matches.match('current',season());assert.equal((await db.doc('users/alice').get()).get('rating'),after);
});
