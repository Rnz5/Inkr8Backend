// Capítulo 10 · Casos agregados tras el análisis de mutación (Stryker, 10/11/2026).
// Cada caso mata un mutante que sobrevivía a la suite original; no se modificaron las pruebas existentes.
// Las expectativas se calculan con la regla del producto, no ejecutando el SUT.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ratingChange} = require('../lib/domain/policy/gamePolicy');
const {EvaluateGame} = require('../lib/domain/usecase/gameUseCases');
const {GetWordExample} = require('../lib/domain/usecase/contentUseCases');

// ---------- Víctor: zona lineal del ajuste (sin saturar en ±5) ----------
test('UT-VIC-01-C10 ratingChange 100/120/WIN ajuste lineal +1 -> 5', () => {
  // adjustment = (120 - 100) * 0.05 = 1; victoria = round(4 + 1) = 5, sin tope (mine < 150)
  assert.equal(ratingChange(100, 120, 'WIN'), 5);
});
test('UT-VIC-01-C11 ratingChange 120/100/LOSS ajuste lineal -1 -> -7', () => {
  // adjustment = (100 - 120) * 0.05 = -1; derrota = round(-6 - 1) = -7
  assert.equal(ratingChange(120, 100, 'LOSS'), -7);
});

// ---------- Pedro: fronteras del puntaje y mensajes de EvaluateGame ----------
function harness({result = {score: 74, feedback: 'Base'}, completeError} = {}) {
  const calls = [];
  const game = {id: 'g', status: 'PENDING', mode: 'PRACTICE', writingMode: 'STANDARD', content: Array(50).fill('ink').join(' '),
    challenge: {words: [], topic: null, theme: null}};
  const games = {get: async (id) => { calls.push(['get', id]); return game; },
    complete: async (g, r) => { calls.push(['complete', g.id, r.score]); if (completeError) throw completeError; },
    defer: async (id) => calls.push(['defer', id]), fail: async (id, message) => calls.push(['fail', id, message])};
  const sut = new EvaluateGame(games, {evaluate: async () => { calls.push(['evaluate']); return result; }},
    {match: async (id) => calls.push(['match', id])}, {now: () => 0});
  return {sut, calls};
}
test('UT-PED-01-C11 EvaluateGame score 0 es válido y se liquida (frontera inferior)', async () => {
  const {sut, calls} = harness({result: {score: 0, feedback: 'Base'}});
  await sut.execute('g');
  assert.deepEqual(calls, [['get', 'g'], ['evaluate'], ['complete', 'g', 0]]);
});
test('UT-PED-01-C12 EvaluateGame score 100 es válido y se liquida (frontera superior)', async () => {
  const {sut, calls} = harness({result: {score: 100, feedback: 'Base'}});
  await sut.execute('g');
  assert.deepEqual(calls, [['get', 'g'], ['evaluate'], ['complete', 'g', 100]]);
});
test('UT-PED-01-C13 EvaluateGame score 101: mensajes exactos del rechazo y del estado FAILED', async () => {
  const {sut, calls} = harness({result: {score: 101, feedback: 'Base'}});
  await assert.rejects(() => sut.execute('g'), {code: 'failed-precondition', message: 'La evaluación recibida no es válida.'});
  assert.deepEqual(calls, [['get', 'g'], ['evaluate'], ['fail', 'g', 'La evaluación no pudo completarse. Reintenta.']]);
});
test('UT-PED-01-C14 EvaluateGame fallo al liquidar: mensajes de las dos llamadas a fail', async () => {
  const failure = new Error('DB offline');
  const {sut, calls} = harness({completeError: failure});
  await assert.rejects(() => sut.execute('g'), failure);
  assert.deepEqual(calls.filter((c) => c[0] === 'fail').map((c) => c[2]), [
    'No se pudo realizar la actualización. No se pudo conectarse al servidor.',
    'La evaluación no pudo completarse. Reintenta.']);
});

// ---------- Renzo: día por defecto de GetWordExample ----------
test('UT-REN-01-C06 GetWordExample sin día usa el día UTC del reloj', async () => {
  const days = [];
  const now = 3 * 86400000 + 1234; // día 3 desde la época
  const sut = new GetWordExample({dailyWord: async (day) => { days.push(day); return {text: 'ink', sentence: 'A bottle of ink.'}; }}, {now: () => now});
  assert.deepEqual(await sut.execute(), {sentence: 'A bottle of ink.'});
  assert.deepEqual(days, [3]);
});
