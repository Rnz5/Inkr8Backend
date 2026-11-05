const {test} = require('node:test');
const assert = require('node:assert/strict');
const {seasonAt, currentUser, acceptsRating, SEASON_ANCHOR_MS, SEASON_DURATION_MS} = require('../lib/domain/policy/seasonPolicy');
const {league, meritReward, validateWriting, ratingChange} = require('../lib/domain/policy/gamePolicy');
const {EvaluateGame} = require('../lib/domain/usecase/gameUseCases');
const {GetDailyHome, UpdateUserName} = require('../lib/domain/usecase/contentUseCases');
const {ResetLeagues} = require('../lib/domain/usecase/resetLeagues');
const {WORDS_PER_MODE, RANKED_COST} = require('../lib/domain/policy/gamePolicy');
const {isRatingEligibleForMatch, isEligibleForBaseline, BASELINE_WAIT_MS} = require('../lib/domain/policy/matchingPolicy');
const {validateUserName} = require('../lib/domain/policy/userPolicy');

test('matching policies preserve inclusive rating and 48-hour boundaries', () => {
  assert.equal(isRatingEligibleForMatch(20,50),true);
  assert.equal(isRatingEligibleForMatch(50,20),true);
  assert.equal(isRatingEligibleForMatch(20,51),false);
  assert.equal(isRatingEligibleForMatch(51,20),false);
  const created = SEASON_ANCHOR_MS;
  assert.equal(isEligibleForBaseline(created,created + BASELINE_WAIT_MS - 1),false);
  assert.equal(isEligibleForBaseline(created,created + BASELINE_WAIT_MS),true);
  assert.equal(isEligibleForBaseline(created,created + BASELINE_WAIT_MS + 1),true);
  assert.deepEqual(WORDS_PER_MODE,{STANDARD:4,ON_TOPIC:2});
});

test('user name policy enforces visible length and rejects Unicode control characters', () => {
  for (const name of ['Ab','Álvaro','a'.repeat(20)]) assert.equal(validateUserName(name),name);
  for (const name of ['','a','  ','a'.repeat(21),'Ma\nrc o','\nMarco','Marco\t','Ma\u200brco']) {
    assert.throws(() => validateUserName(name),{code:'invalid-argument'});
  }
});

test('home use case keeps the response shape and changes day and season at UTC midnight', async () => {
  let now = SEASON_ANCHOR_MS - 1;
  const days = [], word = {text:'palabra',definition:'Definición',sentence:'Ejemplo'};
  const home = new GetDailyHome({dailyWord:async day => {days.push(day); return word;}},{now:() => now});
  assert.deepEqual(await home.execute(),{word,wordDay:Math.floor(now / 86400000),season:seasonAt(now),rankedCost:RANKED_COST});
  now += 1;
  assert.deepEqual(await home.execute(),{word,wordDay:Math.floor(now / 86400000),season:seasonAt(now),rankedCost:RANKED_COST});
  assert.deepEqual(days,[Math.floor((now - 1) / 86400000),Math.floor(now / 86400000)]);
});

test('name update normalizes endpoint input and rejects invalid names before persistence', async () => {
  const saved = [];
  const update = new UpdateUserName({updateName:async (id,name) => {saved.push({id,name});}});
  await update.execute('alice','  Álvaro  ');
  assert.deepEqual(saved,[{id:'alice',name:'Álvaro'}]);
  for (const name of ['a','  ','Ma\nrc o','a'.repeat(21)]) {
    await assert.rejects(() => update.execute('alice',name),{code:'invalid-argument'});
  }
  assert.equal(saved.length,1);
});

test('league reset requires only the reset capability and uses the current season', async () => {
  const seasons = [], now = SEASON_ANCHOR_MS + SEASON_DURATION_MS;
  const reset = new ResetLeagues({resetAll:async season => {seasons.push(season);}},{now:() => now});
  await reset.execute();
  assert.deepEqual(seasons,[seasonAt(now)]);
});
test('season boundaries use exactly fourteen UTC days, including dates before the anchor', () => {
  assert.equal(seasonAt(SEASON_ANCHOR_MS - 1).index, -1);
  assert.equal(seasonAt(SEASON_ANCHOR_MS).index, 0);
  assert.equal(seasonAt(SEASON_ANCHOR_MS + SEASON_DURATION_MS - 1).index, 0);
  assert.equal(seasonAt(SEASON_ANCHOR_MS + SEASON_DURATION_MS).index, 1);
  assert.equal(seasonAt(Date.parse('2028-02-29T00:00:00Z')).end - seasonAt(Date.parse('2028-02-29T00:00:00Z')).start, SEASON_DURATION_MS);
});
test('reset preserves Merit, is repeatable and cannot regress a newer season', () => {
  const user = {id: 'a', name: 'A', email: null, merit: 1025, rating: 93, seasonIndex: 0};
  const next = seasonAt(SEASON_ANCHOR_MS + SEASON_DURATION_MS);
  const reset = currentUser(user, next);
  assert.equal(reset.rating, 0); assert.equal(reset.merit, user.merit);
  assert.deepEqual(currentUser({...reset, rating: 4}, next), {...reset, rating: 4});
  assert.deepEqual(currentUser(reset, seasonAt(SEASON_ANCHOR_MS)), reset);
  assert.equal(acceptsRating(0, 1), false);
});
test('only six numeric leagues exist and transitions are stable', () => {
  assert.deepEqual([0,29,30,59,60,89,90,119,120,149,150,500].map(league), [1,1,2,2,3,3,4,4,5,5,6,6]);
});
test('basic rewards reject invalid scores and have no additional economy operations', () => {
  assert.equal(meritReward(60, 50, false), 130);
  assert.equal(meritReward(60, 50, true), 195);
  assert.equal(meritReward(0, 50, false), 30);
  for (const value of [NaN, Infinity, -1, 101]) assert.throws(() => meritReward(value, 50, false));
  assert.equal(ratingChange(0, 0, 'WIN'), 4); assert.equal(ratingChange(0, 0, 'LOSS'), -6);
});
test('writing validation accepts limits and rejects empty or oversized text', () => {
  const words = (n) => Array(n).fill('palabra').join(' ');
  for (const n of [50,150]) validateWriting(words(n), 'STANDARD');
  assert.throws(() => validateWriting(words(49), 'STANDARD'));
  assert.throws(() => validateWriting(words(151), 'STANDARD'));
  validateWriting(words(200), 'ON_TOPIC');
  assert.throws(() => validateWriting('', 'ON_TOPIC'));
});
test('evaluated games never run the evaluator or settle rewards again', async () => {
  let calls = 0;
  const games = {get: async () => ({status:'EVALUATED'})};
  await new EvaluateGame(games, {evaluate: async () => {calls++;}}, {}, {now: () => SEASON_ANCHOR_MS}).execute('a');
  assert.equal(calls, 0);
});
test('invalid evaluator responses fail without awarding Merit', async () => {
  let completed = 0, failed = 0;
  const games = {get: async () => ({id:'a', status:'PENDING', mode:'PRACTICE'}), complete: async () => {completed++;}, fail: async () => {failed++;}};
  const useCase = new EvaluateGame(games, {evaluate: async () => ({score:NaN, feedback:'x'})}, {}, {now: () => SEASON_ANCHOR_MS});
  await assert.rejects(() => useCase.execute('a')); assert.equal(completed, 0); assert.equal(failed, 1);
});
test('matching failures cannot mark an already settled evaluation failed', async () => {
  let failed = 0, completed = 0;
  const games = {get: async () => ({id:'a',status:'PENDING',mode:'RANKED'}), complete: async () => {completed++;}, fail: async () => {failed++;}};
  const useCase = new EvaluateGame(games, {evaluate: async () => ({score:65,feedback:'Good'})}, {match: async () => {throw Error('offline');}}, {now: () => SEASON_ANCHOR_MS});
  await assert.rejects(() => useCase.execute('a')); assert.equal(completed, 1); assert.equal(failed, 0);
});

test('constraints validate whole Unicode words, advanced rules and preserve a valid base score', () => {
  const {structureEvaluation,containsWord} = require('../lib/domain/policy/evaluationPolicy');
  assert.equal(containsWord('El árbol creció.', 'árbol'),true);
  assert.equal(containsWord('A sparse forest', 'spar'),false);
  assert.equal(containsWord('Use c++ today', 'c++'),true);
  const game = {writingMode:'ON_TOPIC',content:'Yo cuido el árbol. ¿Qué ocurrirá? ' + Array(50).fill('bosque').join(' '),
    challenge:{words:[{text:'árbol'},{text:'ausente'}],topic:'Naturaleza',advanced:['FIRST_PERSON','QUESTION']}};
  const result = structureEvaluation(game,{score:74,feedback:'Base',topicRelevant:true});
  assert.equal(result.score,74);
  assert.ok(result.feedbackError.includes('detailed feedback') || result.feedbackError.includes('feedback detallado'));
  assert.deepEqual(result.constraints.map(rule=>rule.fulfilled),[true,true,false,true,true,true]);
  const incomplete = structureEvaluation(game,{score:74,feedback:'Base'});
  assert.ok(incomplete.constraintsError === 'Compliance with restrictions could not be verified' || incomplete.constraintsError === 'No se pudo validar el cumplimiento de restricciones');
});

test('evaluation timeouts persist a deferred retry without awarding a reward', async () => {
  const {EvaluationTimeout} = require('../lib/domain/model/models');
  let deferred = 0, completed = 0;
  const games = {get:async()=>({status:'PENDING'}),defer:async()=>{deferred++;},complete:async()=>{completed++;}};
  await new EvaluateGame(games,{evaluate:async()=>{throw new EvaluationTimeout();}},{},{now:()=>0}).execute('id');
  assert.equal(deferred,1); assert.equal(completed,0);
});

test('progress excludes practice and counts victories only among resolved competitive games', async () => {
  const {GetProgress} = require('../lib/domain/usecase/progressUseCases');
  const games = [
    {mode:'PRACTICE',status:'EVALUATED',evaluation:{score:100},match:{outcome:'WIN'}},
    {mode:'RANKED',status:'EVALUATED',evaluation:{score:80},match:{outcome:'WIN'}},
    {mode:'RANKED',status:'EVALUATED',evaluation:{score:60},match:{outcome:'LOSS'}},
    {mode:'RANKED',status:'EVALUATED',evaluation:{score:70}},
  ];
  const result = await new GetProgress({games:async()=>games}).execute('alice');
  assert.deepEqual(result.statistics,{gamesPlayed:3,averageScore:70,bestScore:80,winRate:50});
  assert.equal(result.history.length,3);
});

test('example lookup uses the displayed word day and rejects sentences missing that word', async () => {
  const {GetWordExample} = require('../lib/domain/usecase/contentUseCases');
  let requested;
  const source = {dailyWord:async day=>{requested=day;return {text:'ink',sentence:'A bottle of ink.'};}};
  assert.deepEqual(await new GetWordExample(source,{now:()=>86400000}).execute(0),{sentence:'A bottle of ink.'});
  assert.equal(requested,0);
  source.dailyWord = async()=>({text:'ink',sentence:'Think carefully.'});
  await assert.rejects(()=>new GetWordExample(source,{now:()=>0}).execute(),/No se pudo cargar el ejemplo/);
});
