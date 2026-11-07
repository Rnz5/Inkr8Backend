const {test} = require('node:test');
const assert = require('node:assert/strict');
const {meritReward, league, ratingChange, validateWriting} = require('../lib/domain/policy/gamePolicy');
const {mapUser} = require('../lib/data/dto/userDto');
const {structureEvaluation} = require('../lib/domain/policy/evaluationPolicy');
const {EvaluateGame} = require('../lib/domain/usecase/gameUseCases');
const {GetWordExample} = require('../lib/domain/usecase/contentUseCases');
const {EvaluationTimeout} = require('../lib/domain/model/models');
const words = n => Array(n).fill('ink').join(' ');
const cid = (p,n) => `${p}-C${String(n).padStart(2,'0')}`;

// Oráculo de caracterización de economía: tabla de tramos, no llamadas al SUT.
const rewardCases = [
  [0,50,false,30],[40,50,false,65],[60,50,false,130],[70,50,false,205],
  [80,50,false,305],[90,50,false,405],[95,50,false,505],[0,50,true,45],
  [NaN,50,false,null],[-1,50,false,null],[101,50,false,null],
  [39,50,false,30],[59,50,false,65],[69,50,false,130],[79,50,false,205],
  [89,50,false,305],[94,50,false,405],[100,50,true,757],
  [60,9,false,125],[60,10,false,126],[60,399,false,164],
  [60,400,false,165],[60,401,false,165],[Infinity,50,false,null],
];
rewardCases.forEach(([score,count,ranked,expected],i) => test(`${cid('UT-MAR-01',i+1)} meritReward(${score},${count},${ranked}) -> ${expected ?? 'invalid-argument'}${i<11 ? ' / CB-MAR-01-P'+(i+1) : ''}`, () => {
  if (expected === null) assert.throws(() => meritReward(score,count,ranked),{code:'invalid-argument',message:'Puntuación inválida.'});
  else assert.equal(meritReward(score,count,ranked),expected);
}));

const writingCases = [
  [words(50),'STANDARD',false], [words(50),'ON_TOPIC',false],
  ['x'.repeat(10001),'STANDARD',true],['x'.repeat(10001),'ON_TOPIC',true],
  [words(49),'STANDARD',true],[words(151),'STANDARD',true],
  [words(150),'STANDARD',false],[words(200),'ON_TOPIC',false],
  [words(201),'ON_TOPIC',true],['','STANDARD',true],
  [Array(50).fill('x'.repeat(199)).join(' ')+'x','STANDARD',false],
  [Array(50).fill('x'.repeat(199)).join(' ')+'xx','STANDARD',true],
];
writingCases.forEach(([text,mode,rejected],i) => test(`${cid('CB-PED-01',i+1)} validateWriting ${mode}, caracteres=${text.length}, palabras=${text.trim() ? text.trim().split(/\s+/u).length : 0}`, () => {
  if (rejected) assert.throws(()=>validateWriting(text,mode),{code:'invalid-argument',message:`Escribe entre 50 y ${mode==='STANDARD'?150:200} palabras.`});
  else assert.equal(validateWriting(text,mode),undefined);
}));

const ratingCases = [[100,100,'DRAW',1],[100,100,'LOSS',-6],[100,100,'WIN',4],[150,150,'WIN',3],[180,180,'WIN',2],
  [100,200,'WIN',9],[200,100,'LOSS',-11],[100,200,'LOSS',-1],[0,0,'LOSS',-6]];
ratingCases.forEach(([mine,opponent,outcome,expected],i)=>test(`${cid('UT-VIC-01',i+1)} ratingChange ${mine}/${opponent}/${outcome} -> ${expected}${i<5 ? ' / CB-VIC-01-P'+(i+1):''}`,()=>{
  assert.equal(ratingChange(mine,opponent,outcome),expected);
}));

const leagueCases = [[0,1],[30,2],[60,3],[90,4],[120,5],[150,6],[29,1],[59,2],[89,3],[119,4],[149,5],[151,6]];
leagueCases.forEach(([rating,expected],i)=>test(`${cid('UT-JEA-01',i+1)} league ${rating} -> ${expected}${i<6?' / CB-JEA-01-P'+(i+1):''}`,()=>assert.equal(league(rating),expected)));

const fullUser = {name:'Marco',email:'m@example.test',merit:1000,rating:60,seasonIndex:0,username:'marco'};
const defaultUser = {id:'u',name:'Writer',email:null,merit:0,rating:0,seasonIndex:Number.MIN_SAFE_INTEGER,username:null};
const mappedUser = {id:'u',...fullUser};
test('UT-MAT-01-C01 / CB-MAT-01-P1 mapUser conserva todos los campos',()=>assert.deepEqual(mapUser('u',fullUser),mappedUser));
Object.keys(fullUser).forEach((key,i)=>test(`${cid('UT-MAT-01',i+2)} / CB-MAT-01-P${i+2} mapUser default de ${key}`,()=>{
  const dto={...fullUser}; delete dto[key];
  assert.deepEqual(mapUser('u',dto),{...mappedUser,[key]:defaultUser[key]});
}));
test('CN-MAT-01-C01 mapUser frontera de siete campos, identidad externa',()=>assert.deepEqual(mapUser('other',fullUser),{...mappedUser,id:'other'}));
test('CN-MAT-01-C02 mapUser conserva cero y cadena vacía según contrato',()=>{
  assert.deepEqual(mapUser('u',{name:'',email:'',merit:0,rating:0,seasonIndex:0,username:''}),{id:'u',name:'Writer',email:'',merit:0,rating:0,seasonIndex:0,username:''});
});
test('CN-MAT-01-C03 mapUser nullish sin validar tipos fuera de UserDto',()=>assert.deepEqual(mapUser('u',{}),defaultUser));

function evaluationHarness({status='PENDING',mode='PRACTICE',result={score:74,feedback:'Base'},error,completeError}={}) {
  const calls=[];
  const game={id:'g',status,mode,writingMode:'STANDARD',content:words(50),challenge:{words:[],topic:null,theme:null}};
  const games={get:async id=>{calls.push(['get',id]);return game;},complete:async(g,r)=>{calls.push(['complete',g.id,r.score]);if(completeError)throw completeError;},
    defer:async id=>calls.push(['defer',id]),fail:async(id,message)=>calls.push(['fail',id,message])};
  const evaluator={evaluate:async()=>{calls.push(['evaluate']);if(error)throw error;return result;}};
  const sut=new EvaluateGame(games,evaluator,{match:async id=>calls.push(['match',id])},{now:()=>0});
  return {sut,calls};
}
test('UT-PED-01-C01 EvaluateGame éxito práctica completa sin match',async()=>{
  const {sut,calls}=evaluationHarness();await sut.execute('g');assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','complete']);
});
test('UT-PED-01-C02 EvaluateGame éxito Ranked completa antes de match',async()=>{
  const {sut,calls}=evaluationHarness({mode:'RANKED'});await sut.execute('g');assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','complete','match']);
});
test('UT-PED-01-C03 EvaluateGame ya evaluado no recompensa',async()=>{
  const {sut,calls}=evaluationHarness({status:'EVALUATED'});await sut.execute('g');assert.deepEqual(calls,[['get','g']]);
});
test('UT-PED-01-C04 EvaluateGame timeout controlado difiere sin completar',async()=>{
  const {sut,calls}=evaluationHarness({error:new EvaluationTimeout()});await sut.execute('g');assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','defer']);
});
for(const [i,score] of [NaN,-1,101].entries())test(`${cid('UT-PED-01',i+5)} EvaluateGame rechaza score=${score}`,async()=>{
  const {sut,calls}=evaluationHarness({result:{score,feedback:'Base'}});await assert.rejects(()=>sut.execute('g'),{code:'failed-precondition'});
  assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','fail']);
});
test('UT-PED-01-C08 EvaluateGame cuota 429 falla sin reintento automático (caracterización AC-02)',async()=>{
  const error=Object.assign(new Error('quota exhausted'),{status:429});
  const {sut,calls}=evaluationHarness({error});await assert.rejects(()=>sut.execute('g'),error);
  assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','fail']);
});
test('UT-PED-01-C09 EvaluateGame fallo de persistencia invoca fail dos veces (diagnóstico)',async()=>{
  const error=new Error('DB offline'),{sut,calls}=evaluationHarness({completeError:error});await assert.rejects(()=>sut.execute('g'),error);
  assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','complete','fail','fail']);
});
test('UT-PED-01-C10 EvaluateGame servicio 503 falla sin diferir (caracterización AC-02)',async()=>{
  const error=Object.assign(new Error('service unavailable'),{status:503});
  const {sut,calls}=evaluationHarness({error});await assert.rejects(()=>sut.execute('g'),error);
  assert.deepEqual(calls.map(c=>c[0]),['get','evaluate','fail']);
});

const exampleCases=[
  [{text:'ink',sentence:'A bottle of ink.'},'A bottle of ink.'],
  [{text:'árbol',sentence:'El ÁRBOL crece.'},'El ÁRBOL crece.'],
  [{text:'ink',sentence:'Think carefully.'},null],
  [{text:'ink',sentence:'   '},null],
];
exampleCases.forEach(([word,expected],i)=>test(`${cid('UT-REN-01',i+1)} GetWordExample ${JSON.stringify(word)}`,async()=>{
  const days=[], sut=new GetWordExample({dailyWord:async day=>{days.push(day);return word;}},{now:()=>86400000});
  if(expected===null) await assert.rejects(()=>sut.execute(0),{code:'failed-precondition'});
  else assert.deepEqual(await sut.execute(0),{sentence:expected});
  assert.deepEqual(days,[0]);
}));
test('UT-REN-01-C05 GetWordExample propaga fallo de proveedor controlado',async()=>{
  const failure=new Error('content unavailable');
  await assert.rejects(()=>new GetWordExample({dailyWord:async()=>{throw failure;}},{now:()=>0}).execute(),failure);
});

const validFeedback={score:74,feedback:'Base',spelling:'Ortografía',vocabulary:'Vocabulario',coherence:'Coherencia',creativity:'Creatividad',topicRelevant:true};
const validGame={id:'g',authorId:'alice',mode:'RANKED',status:'PENDING',seasonIndex:0,timestamp:0,writingMode:'ON_TOPIC',content:'Yo cuido el árbol. ¿Qué ocurrirá? '+Array(50).fill('bosque').join(' '),challenge:{words:[{text:'árbol',definition:'Tree',sentence:'El árbol crece.'}],topic:'Naturaleza',theme:'Vida',advanced:['FIRST_PERSON','QUESTION']}};
test('CN-PED-01-C01 estructura feedback y restricciones desde campos recibidos',()=>{
  const before=structuredClone(validFeedback), result=structureEvaluation(validGame,validFeedback);
  assert.equal(result.score,74);assert.equal(result.feedback,'Base');assert.equal(result.feedbackError,undefined);
  assert.deepEqual(result.constraints.map(c=>c.fulfilled),[true,true,true,true,true]);
  assert.deepEqual(validFeedback,before);
});
test('CN-PED-01-C02 feedback incompleto preserva score y comunica error',()=>{
  const result=structureEvaluation(validGame,{score:74,feedback:'Base'});
  assert.equal(result.score,74);assert.equal(result.feedbackError,'The detailed feedback could not be loaded at this time');
  assert.equal(result.constraintsError,'Compliance with restrictions could not be verified');
});
test('CN-PED-01-C03 texto y palabras ausentes fallan restricciones específicas',()=>{
  const result=structureEvaluation({...validGame,content:words(49)}, {...validFeedback,topicRelevant:false});
  assert.deepEqual(result.constraints.map(c=>c.fulfilled),[false,false,false,false,false]);
});
test('CN-PED-01-C04 writingMode discrimina 151 palabras y conserva detalles',()=>{
  const g={...validGame,content:words(151),challenge:{words:[],topic:null,theme:null,advanced:[]}};
  assert.equal(structureEvaluation(g,validFeedback).constraints[0].fulfilled,true);
  assert.equal(structureEvaluation({...g,writingMode:'STANDARD'},validFeedback).constraints[0].fulfilled,false);
});
test('CN-PED-01-C05 regla avanzada desconocida informa incumplimiento verificable',()=>{
  const result=structureEvaluation({...validGame,challenge:{...validGame.challenge,advanced:['UNKNOWN']}},validFeedback);
  assert.equal(result.constraintsError,'Compliance with restrictions could not be verified');
});
