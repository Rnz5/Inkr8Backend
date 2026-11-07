const {before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
assert.match(process.env.FIRESTORE_EMULATOR_HOST??'',/^(127\.0\.0\.1|localhost):\d+$/,'Only a local Firestore emulator is allowed');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const target=process.env.CAP10_TARGET_FUNCTIONS?path.resolve(process.env.CAP10_TARGET_FUNCTIONS):path.resolve(__dirname,'..');
const {FirebaseMatchRepository}=require(path.join(target,'lib/data/repository/firebaseMatchRepository'));
const {seasonAt,SEASON_ANCHOR_MS,SEASON_DURATION_MS}=require(path.join(target,'lib/domain/policy/seasonPolicy'));
const app=initializeApp({projectId:'demo-inkr8'},'cierre-matchmaking'),db=getFirestore(app);
const state={now:SEASON_ANCHOR_MS+1000},clock={now:()=>state.now};
const matches=new FirebaseMatchRepository(db,clock),season=()=>seasonAt(state.now);
const text=['I','use','ink','tree','river','forest','Why?',...Array(43).fill('word')].join(' ');
const word=(value)=>({text:value,definition:'Fixture definition',sentence:`Use ${value}.`,phonetic:'/fixture/',partOfSpeech:'noun',rarity:'Common'});
const expectedFixtures=new Map();
before(async()=>{assert.equal(text.split(/\s+/u).length,50);});
beforeEach(async()=>{
  const response=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-inkr8/databases/(default)/documents`,{method:'DELETE'});
  assert.equal(response.status,200);state.now=SEASON_ANCHOR_MS+1000;expectedFixtures.clear();
});
after(async()=>{await db.terminate();await deleteApp(app);});
function leagueForFixture(rating){return rating<30?1:rating<60?2:rating<90?3:rating<120?4:rating<150?5:6;}
async function seed(specs){
  const users=new Map(),batch=db.batch();batch.set(db.doc('seasons/s0'),seasonAt(SEASON_ANCHOR_MS));
  for(const spec of specs){
    const uid=spec.uid??spec.id,score=spec.score??80,reward=score===80?457:score===60?195:undefined;
    assert.notEqual(reward,undefined,'The fixture explicitly supports scores 60 and 80');
    const rating=spec.rating??100,profile=users.get(uid)??{id:uid,name:`Player:${uid}`,email:null,username:uid,merit:1000,rating,league:leagueForFixture(rating),seasonIndex:0,accountClosed:!!spec.closed,missing:!!spec.missingProfile};
    assert.equal(profile.rating,rating,'Shared-author fixture ratings must agree');profile.merit+=reward-100;users.set(uid,profile);
    const writingMode=spec.writingMode??'STANDARD',timestamp=spec.timestamp??state.now,mode=spec.mode??'RANKED';
    const game={id:spec.id,authorId:uid,mode,writingMode,status:spec.status??'EVALUATED',matchStatus:spec.matchStatus??'PENDING',content:text,
      challenge:{words:(writingMode==='ON_TOPIC'?['ink','tree']:['ink','tree','river','forest']).map(word),topic:writingMode==='ON_TOPIC'?'Nature':null,theme:writingMode==='ON_TOPIC'?'Life':null,...(writingMode==='ON_TOPIC'?{advanced:['FIRST_PERSON','QUESTION']}:{})},
      seasonIndex:spec.seasonIndex??0,seasonId:`s${spec.seasonIndex??0}`,timestamp,submittedAt:timestamp,queuedAt:timestamp,wordCount:50,entryCost:mode==='RANKED'?100:0,schemaVersion:2,error:null,
      evaluation:{score,feedback:'Fixture feedback',spelling:'S',vocabulary:'V',coherence:'C',creativity:'R',topicRelevant:true,meritEarned:reward}};
    if(spec.evaluation===false)delete game.evaluation;
    batch.set(db.doc(`submissions/${spec.id}`),game);expectedFixtures.set(spec.id,{...spec,uid,initialRating:rating,score,name:profile.name});
  }
  for(const user of users.values())if(!user.missing){const {missing,...data}=user;batch.set(db.doc(`users/${user.id}`),data);batch.set(db.doc(`seasons/s0/members/${user.id}`),{userId:user.id,name:user.name,rating:user.rating,league:user.league});}
  await batch.commit();
}
async function observe(){
  const games=(await db.collection('submissions').get()).docs.map(d=>({id:d.id,...d.data()}));
  const uids=[...new Set([...expectedFixtures.values()].map(s=>s.uid))];
  const users=await Promise.all(uids.map(async uid=>{const d=await db.doc(`users/${uid}`).get();return d.exists?{id:uid,exists:true,...d.data()}:{id:uid,exists:false};}));
  return {games,users};
}
async function wave(ids){
  const start=process.hrtime.bigint(),ms=()=>Number(process.hrtime.bigint()-start)/1e6,rows=[];
  const settled=await Promise.allSettled(ids.map(async id=>{const row={id,start_ms:ms()};rows.push(row);try{await matches.match(id,season());row.status='fulfilled';}catch(error){row.status='rejected';row.error={code:error.code,message:error.message};throw error;}finally{row.end_ms=ms();}}));
  let active=0,peak=0;for(const [,d]of rows.flatMap(r=>[[r.start_ms,1],[r.end_ms,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])){active+=d;peak=Math.max(peak,active);}
  return {attempted:ids.length,fulfilled:settled.filter(r=>r.status==='fulfilled').length,peak,rows};
}
function pairs(snapshot,before){
  const matched=snapshot.games.filter(g=>g.matchStatus==='MATCHED'),keys=new Set(),violations=[];
  for(const game of matched){
    const fixture=expectedFixtures.get(game.id);if(!fixture)continue;
    const opponent=matched.find(g=>g.id!==game.id&&expectedFixtures.get(g.id)?.name===game.match?.opponentName);
    if(!opponent){violations.push({id:game.id,type:'unidentified-opponent'});continue;}
    const other=expectedFixtures.get(opponent.id);
    if(opponent.match?.opponentName!==fixture.name||game.authorId===opponent.authorId)violations.push({id:game.id,type:'reciprocity-or-self-match'});
    if(game.mode!=='RANKED'||opponent.mode!=='RANKED'||game.writingMode!==opponent.writingMode||game.seasonIndex!==opponent.seasonIndex)violations.push({id:game.id,type:'mode-or-season'});
    if(Math.abs(fixture.initialRating-other.initialRating)>30)violations.push({id:game.id,type:'delta'});
    const outcome=fixture.score===other.score?'DRAW':fixture.score>other.score?'WIN':'LOSS';
    if(game.match?.opponentScore!==other.score||game.match?.outcome!==outcome)violations.push({id:game.id,type:'score-or-outcome'});
    keys.add([game.id,opponent.id].sort().join('/'));
  }
  for(const user of snapshot.users.filter(u=>u.exists)){
    const old=before.users.find(u=>u.id===user.id),delta=matched.filter(g=>g.authorId===user.id).reduce((sum,g)=>sum+(g.match?.ratingChange??0),0);
    if(user.merit!==old.merit||user.rating!==old.rating+delta)violations.push({uid:user.id,type:'economy-or-rating-once'});
  }
  if(matched.length!==keys.size*2)violations.push({type:'pair-cardinality'});
  return {matched:matched.length,pairs:keys.size,pending:snapshot.games.filter(g=>g.matchStatus==='PENDING').length,violations};
}
function record(id,data){const report={id,target,project:'demo-inkr8',host:process.env.FIRESTORE_EMULATOR_HOST,...data};if(process.env.CAP10_EVIDENCE_DIR)fs.writeFileSync(path.join(process.env.CAP10_EVIDENCE_DIR,id+'.json'),JSON.stringify(report,null,2));console.log(id+' '+JSON.stringify({target,evidence:id+'.json',requests:data.requests?{attempted:data.requests.attempted,fulfilled:data.requests.fulfilled,peak:data.requests.peak}:undefined,invariants:data.invariants,scope:data.scope}));}
async function queryWindow(){return db.collection('submissions').where('seasonIndex','==',0).where('matchStatus','==','PENDING').orderBy('timestamp').limit(100).get();}
module.exports={assert,db,state,matches,season,seed,observe,wave,pairs,record,queryWindow,SEASON_ANCHOR_MS,SEASON_DURATION_MS};
