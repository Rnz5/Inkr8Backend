// =====================================================================================
// HU 1.1 · Registro con Google · Responsable: Matías Gonzalo Villar Córdova Alva
// Ejecutar:  npm run test:hu:matias   (desde la carpeta functions)
//
//  CB  league(rating)                       src/domain/policy/gamePolicy.ts:17     V(G) = 6
//      Se ejecuta en todo registro: InitializeUser.execute devuelve el perfil con league(user.rating)
//      (liga 1 para la cuenta nueva; si la cuenta de Google ya existía, la liga de su rating).
//  CN  FirebaseUserRepository.initialize    src/data/repository/firebaseUserRepository.ts:15
//      Entradas (5): uid, nombre de Google, email de Google, instante del registro, estado previo de la cuenta.
//  UT  InitializeUser.execute               src/domain/usecase/contentUseCases.ts:29   (5 casos, repositorio espía)
//
// Los valores esperados se calcularon a mano desde el criterio de HU 1.1 (perfil inicial: 1000 de mérito,
// rating 0, liga 1, sin username) y desde la regla de temporadas (ancla 2026-10-12, 14 días).
// =====================================================================================
const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const {league} = require('../../lib/domain/policy/gamePolicy');
const {FirebaseUserRepository} = require('../../lib/data/repository/firebaseUserRepository');
const {InitializeUser} = require('../../lib/domain/usecase/contentUseCases');
const {FirestoreFalso, relojFijo} = require('./apoyo/firestoreFalso.cjs');

// ---------- CAJA BLANCA: league(rating) ----------
// rating < 30 ? 1 : rating < 60 ? 2 : rating < 90 ? 3 : rating < 120 ? 4 : rating < 150 ? 5 : 6
// Decisiones: d1 (<30), d2 (<60), d3 (<90), d4 (<120), d5 (<150)  ->  V(G) = 5 + 1 = 6 caminos básicos.
// Cada camino se ejecuta con el primer valor de su rango para detectar también errores de frontera (< por <=).
describe('HU 1.1 · Matías · Caja blanca · league', () => {
  test('HU11-CB-C01 camino 1: d1 V (registro nuevo, rating 0) -> liga 1', () => assert.equal(league(0), 1));
  test('HU11-CB-C02 camino 2: d1 F, d2 V (rating 30, frontera) -> liga 2', () => assert.equal(league(30), 2));
  test('HU11-CB-C03 camino 3: d1-d2 F, d3 V (rating 60, frontera) -> liga 3', () => assert.equal(league(60), 3));
  test('HU11-CB-C04 camino 4: d1-d3 F, d4 V (rating 90, frontera) -> liga 4', () => assert.equal(league(90), 4));
  test('HU11-CB-C05 camino 5: d1-d4 F, d5 V (rating 120, frontera) -> liga 5', () => assert.equal(league(120), 5));
  test('HU11-CB-C06 camino 6: d1-d5 F (rating 150, frontera) -> liga 6', () => assert.equal(league(150), 6));
});

// ---------- CAJA NEGRA: registro (FirebaseUserRepository.initialize) ----------
// Clases de equivalencia (V = válida, NV = no válida o rechazada):
//  E1 nombre de Google: V1 no vacío | V2 vacío -> "Writer"
//  E2 email de Google:  V3 texto    | V4 null -> null
//  E3 instante:         V5 dentro de la temporada 2 (16/11/2026) | V6 antes del ancla (01/10/2026 -> temporada -1)
//  E4 estado previo:    V7 sin documento -> crea | V8 cuenta ya registrada -> no duplica | NV1 cuenta cerrada -> rechaza
//  E5 uid:              V9 uid de Firebase (no vacío; lo garantiza el token)
const ahora = '2026-11-16T15:00:00Z';
const temporada2 = {id: 's2', index: 2, start: 1794182400000, end: 1795392000000};
const registrar = (db, iso, uid, nombre, email) => new FirebaseUserRepository(db, relojFijo(iso)).initialize(uid, nombre, email, temporada2);

describe('HU 1.1 · Matías · Caja negra · registro con Google', () => {
  test('HU11-CN-C01 V1+V3+V5+V7+V9: cuenta nueva con nombre y email crea el perfil inicial', async () => {
    const db = new FirestoreFalso();
    const user = await registrar(db, ahora, 'g-001', 'Matías Villar', 'matias@example.test');
    assert.deepEqual(user, {id: 'g-001', name: 'Matías Villar', username: null, email: 'matias@example.test', merit: 1000, rating: 0, seasonIndex: 2});
    assert.deepEqual(db.leer('users/g-001'), {...user, league: 1});
    assert.deepEqual(db.leer('seasons/s2'), temporada2);
    assert.deepEqual(db.leer('seasons/s2/members/g-001'), {userId: 'g-001', name: 'Matías Villar', rating: 0, league: 1});
  });
  test('HU11-CN-C02 V2: cuenta de Google sin nombre se registra como "Writer"', async () => {
    const db = new FirestoreFalso();
    assert.equal((await registrar(db, ahora, 'g-002', '', 'sin.nombre@example.test')).name, 'Writer');
    assert.equal(db.leer('users/g-002').name, 'Writer');
  });
  test('HU11-CN-C03 V4: cuenta de Google sin email se registra con email null', async () => {
    const db = new FirestoreFalso();
    assert.equal((await registrar(db, ahora, 'g-003', 'Ana', null)).email, null);
  });
  test('HU11-CN-C04 V6: registro antes del ancla queda en la temporada -1', async () => {
    const db = new FirestoreFalso();
    const user = await registrar(db, '2026-10-01T00:00:00Z', 'g-004', 'Ana', 'ana@example.test');
    assert.equal(user.seasonIndex, -1);
    assert.deepEqual(db.leer('seasons/s-1'), {id: 's-1', index: -1, start: 1790553600000, end: 1791763200000});
  });
  test('HU11-CN-C05 V8: la misma cuenta de Google ya registrada no se duplica, conserva su mérito y recalcula su liga', async () => {
    const existente = {name: 'Ana', email: 'ana@example.test', merit: 750, rating: 40, seasonIndex: 2, username: 'ana', league: 1};
    const db = new FirestoreFalso({'users/g-005': existente});
    const user = await registrar(db, ahora, 'g-005', 'Otro Nombre', 'otro@example.test');
    assert.deepEqual(user, {id: 'g-005', name: 'Ana', email: 'ana@example.test', merit: 750, rating: 40, seasonIndex: 2, username: 'ana'});
    assert.equal(db.leer('users/g-005').merit, 750);
    assert.equal(db.leer('users/g-005').league, 2); // rating 40 -> liga 2
    assert.equal(db.escrituras.some((w) => w.op === 'create'), false);
  });
  test('HU11-CN-C06 NV1: una cuenta cerrada no puede volver a registrarse', async () => {
    const db = new FirestoreFalso({'users/g-006': {name: 'Ana', accountClosed: true}});
    await assert.rejects(registrar(db, ahora, 'g-006', 'Ana', null), {code: 'permission-denied', message: 'Esta cuenta está cerrada.'});
    assert.equal(db.escrituras.length, 0);
  });
});

// ---------- PRUEBA UNITARIA: InitializeUser.execute ----------
// Aísla el caso de uso con un repositorio espía (equivalente al mock/verify de Mockito del laboratorio).
function repositorioEspia(respuesta) {
  const llamadas = [];
  return {llamadas, initialize: async (...args) => { llamadas.push(args); if (respuesta instanceof Error) throw respuesta; return respuesta; }};
}
describe('HU 1.1 · Matías · Unitaria · InitializeUser.execute', () => {
  const base = {id: 'g-1', name: 'Matías', email: 'm@example.test', merit: 1000, rating: 0, seasonIndex: 2, username: null};
  test('HU11-UT-C01 delega una sola vez con uid, nombre, email y la temporada del reloj', async () => {
    const repo = repositorioEspia(base);
    await new InitializeUser(repo, relojFijo(ahora)).execute('g-1', 'Matías', 'm@example.test');
    assert.deepEqual(repo.llamadas, [['g-1', 'Matías', 'm@example.test', temporada2]]);
  });
  test('HU11-UT-C02 agrega liga 1 al perfil nuevo sin alterar los demás campos', async () => {
    const result = await new InitializeUser(repositorioEspia(base), relojFijo(ahora)).execute('g-1', 'Matías', 'm@example.test');
    assert.deepEqual(result, {...base, league: 1});
  });
  test('HU11-UT-C03 cuenta existente con rating 95 recibe liga 4', async () => {
    const result = await new InitializeUser(repositorioEspia({...base, rating: 95}), relojFijo(ahora)).execute('g-1', 'Matías', null);
    assert.equal(result.league, 4);
  });
  test('HU11-UT-C04 email null se propaga como null', async () => {
    const repo = repositorioEspia({...base, email: null});
    await new InitializeUser(repo, relojFijo(ahora)).execute('g-1', 'Matías', null);
    assert.equal(repo.llamadas[0][2], null);
  });
  test('HU11-UT-C05 el error del repositorio se propaga sin respuesta parcial', async () => {
    const error = Object.assign(new Error('Esta cuenta está cerrada.'), {code: 'permission-denied'});
    await assert.rejects(new InitializeUser(repositorioEspia(error), relojFijo(ahora)).execute('g-1', 'M', null), error);
  });
});
