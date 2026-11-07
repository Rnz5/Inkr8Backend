const {test, before, beforeEach, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/, 'Only a local Firestore emulator is allowed');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {initializeTestEnvironment} = require('@firebase/rules-unit-testing');
const {FirebaseContentRepository} = require('../lib/data/repository/firebaseContentRepository');
const {GetDailyHome} = require('../lib/domain/usecase/contentUseCases');
const {SEASON_ANCHOR_MS} = require('../lib/domain/policy/seasonPolicy');

// Five controlled fields enter through the real Firestore catalogue, not through
// the getHome payload. No private helper is called and no Firestore method is faked.
const projectId = 'demo-inkr8';
const app = initializeApp({projectId}, 'cierre-cn-renzo');
const db = getFirestore(app);
const clock = {now: () => SEASON_ANCHOR_MS};
const day = Math.floor(SEASON_ANCHOR_MS / 86400000);
const catalogRef = db.doc('words/fixture-word');
const cacheRef = db.doc(`dailyWords/${day}`);
const source = Object.freeze({
  word: 'ink', definition: 'A fluid used for writing.', phonetic: '/ɪŋk/',
  partOfSpeech: 'noun', rarity: 'common', sentence: 'Use ink and quill.', isActive: true,
});
const expectedWord = Object.freeze({
  text: 'ink', definition: 'A fluid used for writing.', phonetic: '/ɪŋk/',
  partOfSpeech: 'noun', rarity: 'common', sentence: 'Use ink and quill.',
});
const fieldCases = [
  ['word', 'text', 'quill'], ['definition', 'definition', 'A writing fluid.'],
  ['phonetic', 'phonetic', '/ink/'], ['partOfSpeech', 'partOfSpeech', 'mass noun'],
  ['rarity', 'rarity', 'rare'],
];
const unavailable = {code: 'failed-precondition', message: 'No hay palabras activas disponibles.'};
const incomplete = {code: 'failed-precondition', message: 'La palabra del momento no tiene su información completa.'};
const evidence = [];
let environment;

function home() { return new GetDailyHome(new FirebaseContentRepository(db), clock); }
function record(id, details) {
  const row = {id, ...details}; evidence.push(row);
  console.log('CIERRE_CN_RENZO ' + JSON.stringify(row));
}

before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  environment = await initializeTestEnvironment({projectId, firestore: {
    host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
  }});
});
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => {
  if (process.env.CIERRE_CN_RENZO_EVIDENCE_DIR) {
    const directory = path.resolve(process.env.CIERRE_CN_RENZO_EVIDENCE_DIR);
    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, 'casos_observados.json'), JSON.stringify({
      boundary: 'GetDailyHome.execute -> FirebaseContentRepository.dailyWord -> Firestore',
      input_kind: 'Five persisted catalogue fields, not five callable/form fields',
      catalogue_fields: fieldCases.map(([field]) => field), direct_dailyWord_arguments: ['day'],
      invoked_private_helpers: false, node: process.version, cases_recorded_after_assertions: evidence.length,
      cases: evidence,
    }, null, 2) + '\n');
  }
  if (environment) await environment.cleanup();
  await db.terminate();
  await deleteApp(app);
});

test('CIERRE-CN-REN-C01 Home expone cinco metadatos completos y crea cache exacto', async () => {
  await catalogRef.set(source);
  const result = await home().execute();
  assert.deepEqual(result.word, expectedWord);
  assert.equal(result.wordDay, day);
  assert.deepEqual((await cacheRef.get()).data(), expectedWord);
  assert.deepEqual((await catalogRef.get()).data(), source);
  record('CIERRE-CN-REN-C01', {partition: 'complete', word: result.word, cache: 'created exactly'});
});

fieldCases.forEach(([field, outputField, value], index) => {
  const id = `CIERRE-CN-REN-C${String(index + 2).padStart(2, '0')}`;
  test(`${id} Home conserva variacion correcta del campo persistido ${field}`, async () => {
    const input = {...source, [field]: value};
    await catalogRef.set(input);
    const result = await home().execute();
    const expected = {...expectedWord, [outputField]: value};
    assert.deepEqual(result.word, expected);
    assert.deepEqual((await cacheRef.get()).data(), expected);
    assert.deepEqual((await catalogRef.get()).data(), input);
    record(id, {field, partition: 'alternative nonempty', input: value, word: result.word, cache: 'created exactly'});
  });
});

fieldCases.forEach(([field], fieldIndex) => {
  [['empty', ''], ['whitespace', ' \t\n '], ['absent', undefined]].forEach(([partition, value], partitionIndex) => {
    const id = `CIERRE-CN-REN-C${String(7 + fieldIndex * 3 + partitionIndex).padStart(2, '0')}`;
    test(`${id} Home rechaza ${field} ${partition} sin crear cache ni modificar catalogo`, async () => {
      const input = {...source};
      if (partition === 'absent') delete input[field]; else input[field] = value;
      await catalogRef.set(input);
      await assert.rejects(() => home().execute(), field === 'word' ? unavailable : incomplete);
      assert.equal((await cacheRef.get()).exists, false);
      assert.deepEqual((await catalogRef.get()).data(), input);
      record(id, {field, partition, error: field === 'word' ? unavailable : incomplete, cache: 'absent', catalogue: 'unchanged'});
    });
  });
});

test('CIERRE-CN-REN-C22 cache valido conserva los cinco metadatos aunque no haya catalogo', async () => {
  await cacheRef.set(expectedWord);
  const result = await home().execute();
  assert.deepEqual(result.word, expectedWord);
  assert.deepEqual((await cacheRef.get()).data(), expectedWord);
  assert.equal((await catalogRef.get()).exists, false);
  record('CIERRE-CN-REN-C22', {partition: 'valid cache; empty catalogue', word: result.word, cache: 'unchanged'});
});

test('CIERRE-CN-REN-C23 cache incompleto se repara desde palabra activa del mismo texto', async () => {
  await cacheRef.set({...expectedWord, definition: ''});
  await catalogRef.set(source);
  const result = await home().execute();
  assert.deepEqual(result.word, expectedWord);
  assert.deepEqual((await cacheRef.get()).data(), expectedWord);
  assert.deepEqual((await catalogRef.get()).data(), source);
  record('CIERRE-CN-REN-C23', {partition: 'incomplete cache; matching complete source', word: result.word, cache: 'repaired exactly'});
});

test('CIERRE-CN-REN-C24 cache incompleto de texto inexistente falla sin cambiar palabra del dia', async () => {
  const saved = {...expectedWord, text: 'missing', definition: ''};
  await cacheRef.set(saved);
  await catalogRef.set(source);
  await assert.rejects(() => home().execute(), incomplete);
  assert.deepEqual((await cacheRef.get()).data(), saved);
  assert.deepEqual((await catalogRef.get()).data(), source);
  record('CIERRE-CN-REN-C24', {partition: 'incomplete cache; source text unavailable', error: incomplete, cache: 'unchanged'});
});

test('CIERRE-CN-REN-C25 palabra inactiva no se usa ni crea cache', async () => {
  const input = {...source, isActive: false};
  await catalogRef.set(input);
  await assert.rejects(() => home().execute(), unavailable);
  assert.equal((await cacheRef.get()).exists, false);
  assert.deepEqual((await catalogRef.get()).data(), input);
  record('CIERRE-CN-REN-C25', {partition: 'inactive catalogue word', error: unavailable, cache: 'absent'});
});
