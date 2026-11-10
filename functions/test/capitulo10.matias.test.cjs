// Capítulo 10 · Paquete de Matías Villar.
// CN-MAT-01-C04..C07 amplían la caja negra de mapUser (frontera: DTO de usuario recibido por el mapper).
// UT-MAT-02-C01..C08 son la prueba unitaria de GetProgress.execute (estadísticas del perfil, HU 1.8 y HU 1.10).
// Las expectativas se calcularon a mano a partir del criterio de HU 1.8 (partidas jugadas, promedio,
// mejor puntaje y porcentaje de victorias) y del contrato UserDto; no se obtienen ejecutando el SUT.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mapUser} = require('../lib/data/dto/userDto');
const {GetProgress} = require('../lib/domain/usecase/progressUseCases');

// ---------- Caja negra de mapUser: clases adicionales ----------
const defaults = {name: 'Writer', email: null, merit: 0, rating: 0, seasonIndex: Number.MIN_SAFE_INTEGER, username: null};

test('CN-MAT-01-C04 mapUser valores null explícitos equivalen a ausentes', () => {
  const dto = {name: null, email: null, merit: null, rating: null, seasonIndex: null, username: null};
  assert.deepEqual(mapUser('u', dto), {id: 'u', ...defaults});
});

test('CN-MAT-01-C05 mapUser nombre de un carácter y nombre de solo espacios se conservan', () => {
  assert.equal(mapUser('u', {name: 'M'}).name, 'M');
  // || solo sustituye valores falsy: una cadena de espacios es truthy y no se recorta en el mapper.
  assert.equal(mapUser('u', {name: '   '}).name, '   ');
});

test('CN-MAT-01-C06 mapUser no exporta campos ajenos al contrato User', () => {
  const dto = {id: 'ignored', name: 'Ana', email: 'a@example.test', merit: 250, rating: 90, seasonIndex: 2,
    username: 'ana', accountClosed: true, league: 4};
  const user = mapUser('ext', dto);
  assert.deepEqual(user, {id: 'ext', name: 'Ana', email: 'a@example.test', merit: 250, rating: 90, seasonIndex: 2, username: 'ana'});
  assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'merit', 'name', 'rating', 'seasonIndex', 'username']);
});

test('CN-MAT-01-C07 mapUser conserva temporada anterior al ancla (seasonIndex negativo)', () => {
  assert.equal(mapUser('u', {seasonIndex: -1}).seasonIndex, -1);
  assert.equal(mapUser('u', {seasonIndex: -1, rating: 30}).rating, 30);
});

// ---------- Prueba unitaria de GetProgress.execute ----------
const ranked = (score, outcome, extra = {}) => ({
  id: extra.id ?? `r${score}${outcome ?? ''}`, authorId: 'alice', mode: 'RANKED', writingMode: 'STANDARD', status: 'EVALUATED',
  challenge: {words: [], topic: null, theme: null}, content: '', seasonIndex: 0, timestamp: 0,
  ...(score === undefined ? {} : {evaluation: {score, feedback: 'ok', meritEarned: 0}}),
  ...(outcome ? {match: {outcome}} : {}),
  ...extra,
});
function harness(games, failure) {
  const calls = [];
  const sut = new GetProgress({games: async (userId) => { calls.push(userId); if (failure) throw failure; return games; }});
  return {sut, calls};
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test('UT-MAT-02-C01 GetProgress historial vacío devuelve métricas en cero', async () => {
  const {sut, calls} = harness([]);
  const result = await sut.execute('alice');
  assert.deepEqual(result, {history: [], statistics: {gamesPlayed: 0, averageScore: 0, bestScore: 0, winRate: 0}});
  assert.deepEqual(calls, ['alice']);
});

test('UT-MAT-02-C02 GetProgress excluye Practice evaluada de las métricas competitivas', async () => {
  const practice = ranked(90, 'WIN', {id: 'p1', mode: 'PRACTICE'});
  const {sut} = harness([practice, ranked(70)]);
  const result = await sut.execute('alice');
  assert.deepEqual(result.statistics, {gamesPlayed: 1, averageScore: 70, bestScore: 70, winRate: 0});
  assert.deepEqual(result.history.map((g) => g.id), ['r70']);
});

test('UT-MAT-02-C03 GetProgress excluye Ranked en DRAFT, PENDING y FAILED aunque traigan datos residuales', async () => {
  const residual = ['DRAFT', 'PENDING', 'FAILED'].map((status) => ranked(100, 'WIN', {id: status, status}));
  const {sut} = harness([...residual, ranked(50, 'LOSS')]);
  const result = await sut.execute('alice');
  assert.deepEqual(result.statistics, {gamesPlayed: 1, averageScore: 50, bestScore: 50, winRate: 0});
});

test('UT-MAT-02-C04 GetProgress no inventa puntaje para una Ranked EVALUATED sin evaluación', async () => {
  const {sut} = harness([ranked(undefined, 'WIN', {id: 'sin-evaluacion'}), ranked(40)]);
  const result = await sut.execute('alice');
  assert.deepEqual(result.statistics, {gamesPlayed: 1, averageScore: 40, bestScore: 40, winRate: 0});
  assert.deepEqual(result.history.map((g) => g.id), ['r40']);
});

test('UT-MAT-02-C05 GetProgress conserva el puntaje 0 como dato válido (fronteras 0 y 100)', async () => {
  const {sut} = harness([ranked(0), ranked(100)]);
  const result = await sut.execute('alice');
  assert.deepEqual(result.statistics, {gamesPlayed: 2, averageScore: 50, bestScore: 100, winRate: 0});
});

test('UT-MAT-02-C06 GetProgress porcentaje de victorias con empate en el denominador (caracterización)', async () => {
  const {sut} = harness([ranked(80, 'WIN'), ranked(60, 'LOSS'), ranked(70, 'DRAW')]);
  const {statistics} = await sut.execute('alice');
  assert.equal(statistics.gamesPlayed, 3);
  assert.equal(statistics.averageScore, 70);
  assert.equal(statistics.bestScore, 80);
  close(statistics.winRate, 100 / 3); // 1 victoria de 3 partidas resueltas = 33,33 %
});

test('UT-MAT-02-C07 GetProgress promedio no entero sin redondeo', async () => {
  const {sut} = harness([ranked(70, 'WIN'), ranked(75, 'WIN')]);
  const {statistics} = await sut.execute('alice');
  assert.deepEqual(statistics, {gamesPlayed: 2, averageScore: 72.5, bestScore: 75, winRate: 100});
});

test('UT-MAT-02-C08 GetProgress propaga el fallo del repositorio sin devolver un éxito vacío', async () => {
  const failure = new Error('progress unavailable');
  const {sut, calls} = harness([], failure);
  await assert.rejects(() => sut.execute('alice'), failure);
  assert.deepEqual(calls, ['alice']);
});
