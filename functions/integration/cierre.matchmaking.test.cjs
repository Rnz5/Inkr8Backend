const {test}=require('node:test');
const c=require('./cierre.matchmaking.fixture.cjs'),{assert,db,state,matches,season,seed,observe,wave,pairs,record,queryWindow,SEASON_ANCHOR_MS,SEASON_DURATION_MS}=c;
async function unchanged(id,specs,own='a0',passedSeason){await seed(specs);const before=await observe();await matches.match(own,passedSeason??season());const after=await observe();record(id,{fixture:specs,before,after});assert.deepEqual(after,before);}
for(const n of [3,5])test(`MM-FUNC-ODD${n} grupo impar concurrente conserva una partida pendiente`,{timeout:120000},async()=>{
  const specs=Array.from({length:n},(_,i)=>({id:`a${i}`}));await seed(specs);const before=await observe(),requests=await wave(specs.map(s=>s.id)),after=await observe(),invariants=pairs(after,before);
  record(`MM-FUNC-ODD${n}`,{fixture:specs,requests,invariants,after});assert.equal(requests.peak,n);assert.equal(requests.fulfilled,n);assert.deepEqual(invariants.violations,[]);assert.equal(invariants.matched,n-1);assert.equal(invariants.pairs,(n-1)/2);assert.equal(invariants.pending,1);
});
test('MM-FUNC-03 vecino de modo incompatible permite fallback elegible',async()=>{
  const specs=[{id:'a0'},{id:'a1',writingMode:'ON_TOPIC'},{id:'a2',score:60},{id:'a3',writingMode:'ON_TOPIC'}];await seed(specs);const before=await observe();await matches.match('a0',season());const after=await observe();record('MM-FUNC-03',{fixture:specs,after,invariants:pairs(after,before)});
  assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:a2');assert.equal(after.games.find(g=>g.id==='a1').matchStatus,'PENDING');assert.deepEqual(pairs(after,before).violations,[]);
});
test('MM-FUNC-04 vecino del mismo autor permite fallback sin autoemparejar',async()=>{
  const specs=[{id:'a0',uid:'alice'},{id:'a1',uid:'alice'},{id:'a2',uid:'bob',score:60}];await seed(specs);const before=await observe();await matches.match('a0',season());const after=await observe();record('MM-FUNC-04',{fixture:specs,after,invariants:pairs(after,before)});
  assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:bob');assert.equal(after.games.find(g=>g.id==='a1').matchStatus,'PENDING');assert.deepEqual(pairs(after,before).violations,[]);
});
test('MM-FUNC-05 vecino delta31 se rechaza y delta30 sigue admisible',async()=>{
  const specs=[{id:'a0',rating:100},{id:'a1',rating:131},{id:'a2',rating:130,score:60}];await seed(specs);const before=await observe();await matches.match('a0',season());const after=await observe();record('MM-FUNC-05',{fixture:specs,after,invariants:pairs(after,before)});
  assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:a2');assert.equal(after.games.find(g=>g.id==='a1').matchStatus,'PENDING');assert.equal(after.users.find(u=>u.id==='a1').rating,131);assert.deepEqual(pairs(after,before).violations,[]);
});
test('MM-FUNC-06 vecino cerrado permite fallback y no altera perfil cerrado',async()=>{
  const specs=[{id:'a0'},{id:'a1',closed:true},{id:'a2',score:60}];await seed(specs);const before=await observe();await matches.match('a0',season());const after=await observe();record('MM-FUNC-06',{fixture:specs,after,invariants:pairs(after,before)});
  assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:a2');assert.deepEqual(after.users.find(u=>u.id==='a1'),before.users.find(u=>u.id==='a1'));assert.deepEqual(pairs(after,before).violations,[]);
});
test('MM-FUNC-07 estado no evaluado en cola corrupta se ignora',async()=>{
  const specs=[{id:'a0'},{id:'a1',status:'FAILED'},{id:'a2',score:60}];await seed(specs);await matches.match('a0',season());const after=await observe();record('MM-FUNC-07',{fixture_kind:'defensive malformed queue',fixture:specs,after});assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:a2');assert.equal(after.games.find(g=>g.id==='a1').status,'FAILED');
});
test('MM-FUNC-08 modo PRACTICE en cola corrupta no se empareja',async()=>{await unchanged('MM-FUNC-08',[{id:'a0'},{id:'a1',mode:'PRACTICE'}]);});
test('MM-FUNC-09 propio ya resuelto no vuelve a modificar jugadores',async()=>{await unchanged('MM-FUNC-09',[{id:'a0',matchStatus:'NONE'},{id:'a1'}]);});
test('MM-FUNC-10 partida propia de temporada anterior no se mezcla',async()=>{await unchanged('MM-FUNC-10',[{id:'a0',seasonIndex:-1,timestamp:SEASON_ANCHOR_MS-1},{id:'a1'}]);});
test('MM-FUNC-11 rival de temporada anterior no entra en consulta actual',async()=>{await unchanged('MM-FUNC-11',[{id:'a0'},{id:'a1',seasonIndex:-1,timestamp:SEASON_ANCHOR_MS-1}]);});
test('MM-FUNC-12 worker con temporada capturada antigua no liquida después del cambio',async()=>{
  const specs=[{id:'a0'},{id:'a1'}];await seed(specs);const before=await observe(),captured=season();state.now+=SEASON_DURATION_MS;await matches.match('a0',captured);const after=await observe();record('MM-FUNC-12',{fixture:specs,capturedSeason:captured,clockNow:state.now,before,after});assert.deepEqual(after,before);
});
test('MM-FUNC-13 perfil de rival ausente no se recrea ni se empareja',async()=>{await unchanged('MM-FUNC-13',[{id:'a0'},{id:'a1',missingProfile:true}]);});
test('MM-FUNC-14 cuenta propia cerrada no modifica ninguna partida',async()=>{await unchanged('MM-FUNC-14',[{id:'a0',closed:true},{id:'a1'}]);});
test('MM-FUNC-15 evaluacion ausente en cola corrupta no se acepta',async()=>{await unchanged('MM-FUNC-15',[{id:'a0'},{id:'a1',evaluation:false}]);});
test('MM-FUNC-16 un grupo antiguo mantiene prioridad frente a vecino reciente',async()=>{
  const specs=[{id:'a0',timestamp:SEASON_ANCHOR_MS+900},{id:'a1',timestamp:SEASON_ANCHOR_MS+900},{id:'old0',timestamp:SEASON_ANCHOR_MS,writingMode:'ON_TOPIC'},{id:'old1',timestamp:SEASON_ANCHOR_MS,score:60}];
  await seed(specs);const before=await observe();await matches.match('a0',season());const after=await observe();record('MM-FUNC-16',{fixture:specs,after,invariants:pairs(after,before)});assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:old1');assert.equal(after.games.find(g=>g.id==='a1').matchStatus,'PENDING');assert.deepEqual(pairs(after,before).violations,[]);
});
function blockers(n){return Array.from({length:n},(_,i)=>({id:`b${String(i).padStart(3,'0')}`,writingMode:'ON_TOPIC',timestamp:SEASON_ANCHOR_MS}));}
test('MM-FUNC-17 ventana exactamente100 incluye al rival elegible final',async()=>{
  const specs=[...blockers(98),{id:'own',timestamp:SEASON_ANCHOR_MS+1},{id:'eligible',timestamp:SEASON_ANCHOR_MS+2,score:60}];await seed(specs);const window=await queryWindow();assert.equal(window.size,100);assert.ok(window.docs.some(d=>d.id==='eligible'));const before=await observe();await matches.match('own',season());const after=await observe();record('MM-FUNC-17',{fixture_count:100,window:window.docs.map(d=>d.id),after,invariants:pairs(after,before)});assert.equal(after.games.find(g=>g.id==='own').match.opponentName,'Player:eligible');assert.deepEqual(pairs(after,before).violations,[]);
});
test('MM-FUNC-18 con101 el rival fuera de la ventana no se alcanza: limite preexistente',async()=>{
  const specs=[...blockers(99),{id:'own',timestamp:SEASON_ANCHOR_MS+1},{id:'eligible',timestamp:SEASON_ANCHOR_MS+2,score:60}];await seed(specs);const before=await observe(),window=await queryWindow();assert.equal(window.size,100);assert.ok(window.docs.some(d=>d.id==='own'));assert.ok(!window.docs.some(d=>d.id==='eligible'));await matches.match('own',season());const after=await observe();record('MM-FUNC-18',{scope:'characterization of pre-existing limit, not closure of starvation',fixture_count:101,window:window.docs.map(d=>d.id),before,after});assert.deepEqual(after,before);
});
test('MM-FUNC-19 propio fuera de100 usa fallback y puede encontrar rival dentro',async()=>{
  const specs=[...blockers(100),{id:'own',timestamp:SEASON_ANCHOR_MS+1}];specs[0].writingMode='STANDARD';specs[0].score=60;await seed(specs);const before=await observe(),window=await queryWindow();assert.equal(window.size,100);assert.ok(!window.docs.some(d=>d.id==='own'));await matches.match('own',season());const after=await observe();record('MM-FUNC-19',{fixture_count:101,window:window.docs.map(d=>d.id),after,invariants:pairs(after,before)});assert.equal(after.games.find(g=>g.id==='own').match.opponentName,'Player:b000');assert.deepEqual(pairs(after,before).violations,[]);
});
test('MM-FUNC-20 propio y rival fuera de100 permanecen pendientes: limite preexistente',async()=>{
  const specs=[...blockers(100),{id:'own',timestamp:SEASON_ANCHOR_MS+1},{id:'eligible',timestamp:SEASON_ANCHOR_MS+2,score:60}];await seed(specs);const before=await observe(),window=await queryWindow();assert.ok(!window.docs.some(d=>d.id==='own'));assert.ok(!window.docs.some(d=>d.id==='eligible'));await matches.match('own',season());const after=await observe();record('MM-FUNC-20',{scope:'characterization of pre-existing limit',fixture_count:102,window:window.docs.map(d=>d.id),before,after});assert.deepEqual(after,before);
});
