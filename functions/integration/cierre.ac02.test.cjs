const {test, before, beforeEach, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/, 'Only a local Firestore emulator is allowed');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {initializeTestEnvironment} = require('@firebase/rules-unit-testing');
const {FirebaseUserRepository} = require('../lib/data/repository/firebaseUserRepository');
const {FirebaseGameRepository} = require('../lib/data/repository/firebaseGameRepository');
const {FirebaseMatchRepository} = require('../lib/data/repository/firebaseMatchRepository');
const {EvaluateGame} = require('../lib/domain/usecase/gameUseCases');
const {seasonAt, SEASON_ANCHOR_MS} = require('../lib/domain/policy/seasonPolicy');

const app = initializeApp({projectId: 'demo-inkr8'}, 'cierre-ac02');
const db = getFirestore(app);
let now = SEASON_ANCHOR_MS, environment;
const clock = {now: () => now};
const users = new FirebaseUserRepository(db, clock);
const games = new FirebaseGameRepository(db, clock);
const matches = new FirebaseMatchRepository(db, clock);
const content = Array(50).fill('ink').join(' ');
const challenge = {words: ['ink', 'tree', 'life', 'word'].map(text => ({text, definition: 'Definition', sentence: 'A sentence.'})), topic: null, theme: null};
const records = [];
const enforceAutomatic = process.env.CIERRE_EXIGIR_AC02 === '1';

function record(id, value) { records.push({id, ...value}); console.log('CIERRE_AC02 ' + JSON.stringify({id, ...value})); }
async function prepare() {
  await users.initialize('alice', 'Alice', null, seasonAt(now));
  await games.start('g', 'alice', 'RANKED', 'STANDARD', challenge, seasonAt(now), now);
  await games.submit('g', 'alice', content);
}
async function induce(status) {
  const failure = Object.assign(new Error(status === 429 ? 'controlled quota failure' : 'controlled service unavailable'), {status});
  const evaluator = {evaluate: async () => { throw failure; }};
  await assert.rejects(() => new EvaluateGame(games, evaluator, matches, clock).execute('g'), failure);
  return (await db.doc('submissions/g').get()).data();
}
async function assertOneFinalReward() {
  const evaluator = {evaluate: async () => ({score: 60, feedback: 'Controlled successful retry'})};
  const useCase = new EvaluateGame(games, evaluator, matches, clock);
  await useCase.execute('g'); await useCase.execute('g');
  const saved = (await db.doc('submissions/g').get()).data();
  assert.equal(saved.status, 'EVALUATED'); assert.equal(saved.content, content);
  assert.deepEqual(saved.challenge, challenge);
  assert.equal(saved.evaluation.meritEarned, 195);
  assert.equal((await db.doc('users/alice').get()).get('merit'), 1095);
  assert.equal((await db.collection('submissions').get()).size, 1);
  return saved;
}

before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  environment = await initializeTestEnvironment({projectId: 'demo-inkr8', firestore: {
    host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
  }});
});
beforeEach(async () => { await environment.clearFirestore(); now = SEASON_ANCHOR_MS; });
after(async () => {
  if (process.env.CIERRE_AC02_EVIDENCE_DIR) {
    const directory = path.resolve(process.env.CIERRE_AC02_EVIDENCE_DIR); fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, 'ac02_observado.json'), JSON.stringify({
      level: 'EvaluateGame and repositories real; controlled external evaluator; Firestore emulator',
      automatic_conformance_enforced: enforceAutomatic, records,
    }, null, 2) + '\n');
  }
  if (environment) await environment.cleanup();
  await db.terminate(); await deleteApp(app);
});

[429, 503].forEach(status => {
  test(`CIERRE-AC02-${status}-ACTUAL error persiste texto sin programar recuperacion automatica`, async () => {
    await prepare(); const failed = await induce(status);
    assert.equal(failed.status, 'FAILED'); assert.equal(failed.content, content);
    assert.deepEqual(failed.challenge, challenge);
    assert.equal(failed.nextRetryAt ?? null, null);
    assert.equal((await db.doc('users/alice').get()).get('merit'), 900);
    now += 300000; await games.recoverEvaluations();
    const recovered = (await db.doc('submissions/g').get()).data();
    assert.equal(recovered.status, 'FAILED'); assert.equal(recovered.nextRetryAt ?? null, null);
    assert.equal((await db.collection('submissions').get()).size, 1);
    record(`CIERRE-AC02-${status}-ACTUAL`, {status: recovered.status, nextRetryAt: recovered.nextRetryAt ?? null, content_preserved: recovered.content === content, merit: 900, automatic_recovery: false});
  });

  test(`CIERRE-AC02-${status}-MANUAL reintento explicito conserva ID y acredita una sola vez`, async () => {
    await prepare(); await induce(status);
    await games.retry('g', 'alice'); await games.retry('g', 'alice');
    assert.equal((await games.get('g')).status, 'PENDING');
    const saved = await assertOneFinalReward();
    record(`CIERRE-AC02-${status}-MANUAL`, {status: saved.status, id: 'g', merit: 1095, reward: 195, automatic_recovery_demonstrated: false});
  });

  if (enforceAutomatic) test(`CIERRE-AC02-${status}-CONFORMIDAD scheduler debe recuperar automaticamente error transitorio`, async () => {
    await prepare(); const failed = await induce(status);
    // Enforce AC-02 without selecting a new retry interval, retry budget or text.
    assert.ok(Number.isFinite(failed.nextRetryAt) && failed.nextRetryAt > now, 'AC-02 requires a persisted automatic recovery schedule for quota/availability errors');
    now = failed.nextRetryAt - 1; await games.recoverEvaluations();
    assert.equal((await games.get('g')).status, 'FAILED');
    now += 1; await games.recoverEvaluations();
    assert.equal((await games.get('g')).status, 'PENDING');
    const saved = await assertOneFinalReward();
    record(`CIERRE-AC02-${status}-CONFORMIDAD`, {status: saved.status, automatic_recovery: true, merit: 1095, reward: 195});
  });
});
