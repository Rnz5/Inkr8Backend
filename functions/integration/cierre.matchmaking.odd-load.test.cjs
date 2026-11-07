const {test}=require('node:test');
const {assert,matches,season,seed,observe,wave,pairs,record}=require('./cierre.matchmaking.fixture.cjs');
test('MM-LOAD-51 grupo impar de51 solicitudes realmente solapadas',{timeout:240000},async()=>{
  const specs=Array.from({length:51},(_,i)=>({id:`o${String(i).padStart(2,'0')}`}));await seed(specs);const before=await observe(),requests=await wave(specs.map(s=>s.id)),after=await observe(),invariants=pairs(after,before);record('MM-LOAD-51',{fixture:specs,requests,invariants,after});assert.equal(requests.peak,51);assert.equal(requests.fulfilled,51);assert.deepEqual(invariants.violations,[]);assert.equal(invariants.matched,50);assert.equal(invariants.pairs,25);assert.equal(invariants.pending,1);
});
