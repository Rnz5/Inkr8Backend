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

const starts=[['g1','alice','RANKED','STANDARD',challenge,SEASON_ANCHOR_MS],
  ['g2','alice','PRACTICE','ON_TOPIC',{...challenge,words:challenge.words.slice(0,2),topic:'Life'},SEASON_ANCHOR_MS+1],
  ['g3','bob','RANKED','ON_TOPIC',{...challenge,words:challenge.words.slice(0,2),topic:'Nature'},SEASON_ANCHOR_MS+2]];
starts.forEach(([id,uid,mode,wm,c,t],i)=>test(`CN-MAR-01-C0${i+1} start seis campos efectivos y season sobrescrita no contada`,async()=>{
  const result=await draft(id,uid,mode,wm,c,t),saved=(await db.doc(`submissions/${id}`).get()).data();
  assert.deepEqual(result,{id,authorId:uid,mode,writingMode:wm,challenge:c,status:'DRAFT',content:'',seasonIndex:0,timestamp:t});
  assert.equal(saved.entryCost,mode==='RANKED'?100:0);assert.equal((await db.doc(`users/${uid}`).get()).get('merit'),mode==='RANKED'?900:1000);
}));
test('CN-MAR-01-C04 perfil inexistente rechaza inicio sin crear partida',async()=>{
  await assert.rejects(()=>games.start('g','missing','RANKED','STANDARD',challenge,season(),now),{code:'permission-denied'});
  assert.equal((await db.doc('submissions/g').get()).exists,false);
});
for(const [i,balance] of [99,100,101].entries())test(`AC05-C0${i+1} Ranked saldo ${balance}`,async()=>{
  await users.initialize('alice','Alice',null,season());await db.doc('users/alice').update({merit:balance});
  if(balance<100){await assert.rejects(()=>games.start('g','alice','RANKED','STANDARD',challenge,season(),now),{code:'failed-precondition',message:'The ranked match cannot be started. Insufficient Merit'});assert.equal((await db.doc('submissions/g').get()).exists,false);}
  else await games.start('g','alice','RANKED','STANDARD',challenge,season(),now);
  assert.equal((await db.doc('users/alice').get()).get('merit'),balance<100?99:balance-100);
});
test('AC05-C04 diez partidas compiten por los mismos 100 Merit', {timeout:120000},async()=>{
  await users.initialize('alice','Alice',null,season());await db.doc('users/alice').update({merit:100});
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>games.start(`race${i}`,'alice','RANKED','STANDARD',challenge,season(),now)));
  const observed={fulfilled:results.filter(r=>r.status==='fulfilled').length,rejected:results.filter(r=>r.status==='rejected').map(r=>({code:r.reason.code,message:r.reason.message})),balance:(await db.doc('users/alice').get()).get('merit'),games:(await db.collection('submissions').get()).size};
  evidence('AC05_competencia',observed);assert.equal(observed.fulfilled,1);assert.equal(observed.balance,0);assert.equal(observed.games,1);
  assert.ok(observed.rejected.every(e=>e.code==='failed-precondition'));
});

const completes=[['RANKED',50,60,195,'PENDING'],['PRACTICE',60,60,131,'NONE'],['RANKED',50,95,757,'EXPIRED']];
completes.forEach(([mode,count,score,reward,matchStatus],i)=>test(`CN-VIC-01-C0${i+1} complete campos del Game y Evaluation influyen en liquidación`,async()=>{
  if(matchStatus==='EXPIRED')now=SEASON_ANCHOR_MS-1;
  const game=await pending('g','alice',mode,count);if(matchStatus==='EXPIRED')now=SEASON_ANCHOR_MS;
  await games.complete(game,{score,feedback:'Feedback específico'},season());
  const saved=(await db.doc('submissions/g').get()).data();assert.equal(saved.evaluation.meritEarned,reward);assert.equal(saved.evaluation.feedback,'Feedback específico');
  assert.equal(saved.matchStatus,matchStatus);assert.equal(saved.status,'EVALUATED');assert.equal((await db.doc('users/alice').get()).get('merit'),(mode==='RANKED'?900:1000)+reward);
}));
test('CN-VIC-01-C04 id y authorId dirigen la escritura a otra partida y cuenta',async()=>{
  const game=await pending('other','bob','PRACTICE');await users.initialize('alice','Alice',null,season());
  await games.complete(game,{score:60,feedback:'Otro feedback'},season());
  const saved=(await db.doc('submissions/other').get()).data();assert.equal(saved.evaluation.feedback,'Otro feedback');
  assert.equal(saved.evaluation.score,60);assert.equal((await db.doc('users/bob').get()).get('merit'),1130);assert.equal((await db.doc('users/alice').get()).get('merit'),1000);
});
test('AC04-C01 diez cierres concurrentes y dos repeticiones acreditan una vez',{timeout:120000},async()=>{
  const game=await pending();await Promise.all(Array.from({length:10},()=>games.complete(game,{score:60,feedback:'Base'},season())));
  await games.complete(game,{score:60,feedback:'Base'},season());await games.complete(game,{score:60,feedback:'Base'},season());
  const saved=(await db.doc('submissions/g').get()).data(),balance=(await db.doc('users/alice').get()).get('merit');
  evidence('AC04_idempotencia',{logicalId:'g',concurrentAttempts:10,sequentialRepeats:2,balance,expectedBalance:1095,evaluation:saved.evaluation,status:saved.status});
  assert.equal(balance,1095);assert.equal(saved.status,'EVALUATED');assert.equal(saved.evaluation.meritEarned,195);
});
test('AC02-C01 timeout controlado atraviesa persistencia y reintento del mismo ID',async()=>{
  await pending();const useCase=new EvaluateGame(games,{evaluate:async()=>{throw new EvaluationTimeout();}},matches,clock);await useCase.execute('g');
  const deferred=(await db.doc('submissions/g').get()).data();assert.equal(deferred.status,'FAILED');assert.equal(deferred.nextRetryAt,now+300000);assert.match(deferred.error,/taking longer/);
  now+=299999;await games.recoverEvaluations();assert.equal((await games.get('g')).status,'FAILED');
  now+=1;await games.recoverEvaluations();assert.equal((await games.get('g')).status,'PENDING');
  assert.equal((await db.doc('users/alice').get()).get('merit'),900);
});
test('AC02-C02 cuota 429 persiste FAILED sin nextRetryAt (brecha de requisito)',async()=>{
  await pending();const failure=Object.assign(new Error('quota'),{status:429});
  await assert.rejects(()=>new EvaluateGame(games,{evaluate:async()=>{throw failure;}},matches,clock).execute('g'),failure);
  now+=300000;await games.recoverEvaluations();const saved=(await db.doc('submissions/g').get()).data();
  evidence('AC02_cuota',{status:saved.status,nextRetryAt:saved.nextRetryAt??null,error:saved.error});
  assert.equal(saved.status,'FAILED');assert.equal(saved.nextRetryAt??null,null);assert.equal((await db.doc('users/alice').get()).get('merit'),900);
});

const word={text:'ink',definition:'Fluid',sentence:'Use ink.',phonetic:'/ink/',partOfSpeech:'noun',rarity:'Common'};
const sourceWord=w=>({word:w.text,definition:w.definition,sentence:w.sentence,phonetic:w.phonetic,partOfSpeech:w.partOfSpeech,rarity:w.rarity,isActive:true});
const dailyCases=[
  {saved:word,active:[],ok:true},
  {active:[],error:'No hay palabras activas disponibles.'},
  {saved:{...word,phonetic:''},active:[],error:'No hay palabras activas disponibles.'},
  {active:[word],ok:true},
  {saved:{...word,phonetic:''},active:[word],ok:true},
  {saved:{...word,text:'absent',phonetic:''},active:[word],error:'La palabra del momento no tiene su información completa.'},
  {active:[{...word,phonetic:''}],error:'La palabra del momento no tiene su información completa.'},
];
dailyCases.forEach((c,i)=>test(`CB-REN-01-C0${i+1} dailyWord camino P${i+1}`,async()=>{
  if(c.saved)await db.doc('dailyWords/0').set(c.saved);
  for(const [j,w] of c.active.entries())await db.doc(`words/w${j}`).set(sourceWord(w));
  const repository=new FirebaseContentRepository(db);
  if(c.error)await assert.rejects(()=>repository.dailyWord(0),{code:'failed-precondition',message:c.error});
  else {assert.deepEqual(await repository.dailyWord(0),word);assert.deepEqual((await db.doc('dailyWords/0').get()).data(),word);}
}));
['text','definition','phonetic','partOfSpeech','rarity'].forEach((key,i)=>test(`CN-REN-01-C0${i+1} hasMetadata requiere ${key}`,()=>{
  const repository=new FirebaseContentRepository(db);assert.equal(repository.hasMetadata(word),true);
  assert.equal(repository.hasMetadata({...word,[key]:''}),false);assert.equal(repository.hasMetadata({...word,[key]:'  '}),false);
}));
