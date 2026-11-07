const {test}=require('node:test');
const {assert,matches,season,seed,observe,pairs,record}=require('./cierre.matchmaking.fixture.cjs');
test('MM-POLICY-01 oraculo propuesto: vecino adyacente dentro del empate minimo',async()=>{
  const specs=[{id:'a0'},{id:'a1'},{id:'a2'},{id:'a3'}];await seed(specs);const before=await observe();await matches.match('a2',season());let after=await observe();record('MM-POLICY-01-first',{scope:'new proposed tie policy, not original requirement',fixture:specs,after});
  assert.equal(after.games.find(g=>g.id==='a2').match.opponentName,'Player:a3');await matches.match('a0',season());after=await observe();const invariants=pairs(after,before);record('MM-POLICY-01',{scope:'new proposed tie policy',fixture:specs,after,invariants});assert.equal(after.games.find(g=>g.id==='a0').match.opponentName,'Player:a1');assert.equal(invariants.matched,4);assert.equal(invariants.pairs,2);assert.deepEqual(invariants.violations,[]);
});
