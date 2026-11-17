// =====================================================================================
// HU 1.4 · Cierre de sesión · Responsable: Víctor Manuel Camarena Paredes
// Ejecutar:  npm run test:hu:victor   (desde la carpeta functions)
//
//  CB  authenticated(users, handler)   src/presentation/handlers/callables.ts:5   V(G) = 8
//      Es la barrera del servidor: después de cerrar sesión la app ya no envía token, y toda función
//      (getHome, updateProfile, getWordExample...) pasa por authenticated, que la rechaza.
//  CN  Acceso a las funciones reales de contentHandlers según la sesión.
//      Entradas (5): sesión (token presente/ausente), uid, estado de la cuenta en Firestore,
//      función invocada, datos enviados.
//  UT  SessionViewModel.logout   (Android) -> app/src/test/java/com/inkr8/hu/Hu14VictorTest.kt
// =====================================================================================
const {test, describe, mock} = require('node:test');
const assert = require('node:assert/strict');
const {HttpsError} = require('firebase-functions/v2/https');
const {logger} = require('firebase-functions');
const {authenticated} = require('../../lib/presentation/handlers/callables');
const {contentHandlers} = require('../../lib/presentation/handlers/contentHandlers');
const {FirebaseUserRepository} = require('../../lib/data/repository/firebaseUserRepository');
const {DomainError} = require('../../lib/domain/model/models');
const {FirestoreFalso, relojFijo} = require('./apoyo/firestoreFalso.cjs');

mock.method(logger, 'error', () => {}); // evita ruido en consola; el mensaje se verifica en C07/C08

const usuariosAbiertos = {assertOpen: async () => {}};
const sesion = (uid = 'u-victor') => ({auth: {uid, token: {name: 'Víctor', email: 'v@example.test'}}});

// ---------- CAJA BLANCA: authenticated ----------
// d1 !request.auth          d2 request.data &&       d3 typeof request.data === "object"
// d4 catch (hubo error)     d5 instanceof DomainError   d6 instanceof HttpsError   d7 error instanceof Error ?
// V(G) = 7 + 1 = 8
describe('HU 1.4 · Víctor · Caja blanca · authenticated', () => {
  test('HU14-CB-C01 camino 1: d1 V (sin sesión, como tras cerrar sesión) -> unauthenticated', async () => {
    let ejecutado = false;
    const f = authenticated(usuariosAbiertos, async () => { ejecutado = true; });
    await assert.rejects(f.run({data: {}}), {code: 'unauthenticated', message: 'Inicia sesión para continuar.'});
    assert.equal(ejecutado, false);
  });
  test('HU14-CB-C02 camino 2 (base): sesión y datos objeto -> ejecuta el handler con uid y datos', async () => {
    const f = authenticated(usuariosAbiertos, async (uid, data) => ({uid, data}));
    assert.deepEqual(await f.run({...sesion(), data: {day: 3}}), {uid: 'u-victor', data: {day: 3}});
  });
  test('HU14-CB-C03 camino 3: d2 F (data null) -> el handler recibe {}', async () => {
    const f = authenticated(usuariosAbiertos, async (_uid, data) => data);
    assert.deepEqual(await f.run({...sesion(), data: null}), {});
  });
  test('HU14-CB-C04 camino 4: d2 V, d3 F (data primitivo) -> el handler recibe {}', async () => {
    const f = authenticated(usuariosAbiertos, async (_uid, data) => data);
    assert.deepEqual(await f.run({...sesion(), data: 'texto'}), {});
  });
  test('HU14-CB-C05 camino 5: d4 V, d5 V (DomainError: cuenta cerrada) -> HttpsError con su código', async () => {
    const cerrada = {assertOpen: async () => { throw new DomainError('permission-denied', 'Esta cuenta está cerrada.'); }};
    await assert.rejects(authenticated(cerrada, async () => 1).run(sesion()), {code: 'permission-denied', message: 'Esta cuenta está cerrada.'});
  });
  test('HU14-CB-C06 camino 6: d5 F, d6 V (HttpsError del handler) -> se relanza igual', async () => {
    const original = new HttpsError('not-found', 'No existe.');
    const f = authenticated(usuariosAbiertos, async () => { throw original; });
    await assert.rejects(f.run(sesion()), (e) => e === original);
  });
  test('HU14-CB-C07 camino 7: d6 F, d7 V (Error genérico) -> internal y se registra el mensaje', async () => {
    logger.error.mock.resetCalls();
    const f = authenticated(usuariosAbiertos, async () => { throw new Error('fallo de red'); });
    await assert.rejects(f.run(sesion()), {code: 'internal', message: 'No se pudo completar la operación. Reintenta.'});
    assert.deepEqual(logger.error.mock.calls[0].arguments, ['Callable failed', 'fallo de red']);
  });
  test('HU14-CB-C08 camino 8: d7 F (se lanza algo que no es Error) -> internal con "Unknown error"', async () => {
    logger.error.mock.resetCalls();
    const f = authenticated(usuariosAbiertos, async () => { throw 'texto'; });
    await assert.rejects(f.run(sesion()), {code: 'internal'});
    assert.deepEqual(logger.error.mock.calls[0].arguments, ['Callable failed', 'Unknown error']);
  });
});

// ---------- CAJA NEGRA: acceso a las funciones reales según la sesión ----------
// E1 sesión:      V1 token presente | NV1 ausente (sesión cerrada)
// E2 uid:         V2 uid del token
// E3 cuenta:      V3 abierta | V4 sin documento aún (recién registrada) | NV2 cerrada
// E4 función:     V5 getHome | V6 updateProfile | V7 getWordExample
// E5 datos:       V8 válidos | NV3 ausentes cuando la función los requiere
function endpoints(db, registro) {
  const users = new FirebaseUserRepository(db, relojFijo('2026-11-16T15:00:00Z'));
  const home = {execute: async () => { registro.push('getHome'); return {word: {text: 'ink'}, wordDay: 20773}; }};
  const updateName = {execute: async (uid, name) => { registro.push(`updateProfile:${uid}:${name}`); }};
  const example = {execute: async (day) => { registro.push(`getWordExample:${day}`); return {sentence: 'Use ink.'}; }};
  return contentHandlers(users, {execute: async () => ({})}, updateName, home, {execute: async () => ({})}, example);
}
describe('HU 1.4 · Víctor · Caja negra · acceso con y sin sesión', () => {
  test('HU14-CN-C01 NV1+V5: tras cerrar sesión, getHome se rechaza', async () => {
    const registro = [];
    await assert.rejects(endpoints(new FirestoreFalso(), registro).getHome.run({data: {}}), {code: 'unauthenticated'});
    assert.deepEqual(registro, []);
  });
  test('HU14-CN-C02 NV1+V6: tras cerrar sesión, updateProfile no modifica nada', async () => {
    const registro = [];
    await assert.rejects(endpoints(new FirestoreFalso(), registro).updateProfile.run({data: {name: 'victor'}}), {code: 'unauthenticated'});
    assert.deepEqual(registro, []);
  });
  test('HU14-CN-C03 NV1+V7: tras cerrar sesión, getWordExample se rechaza', async () => {
    const registro = [];
    await assert.rejects(endpoints(new FirestoreFalso(), registro).getWordExample.run({data: {day: 20773}}), {code: 'unauthenticated'});
    assert.deepEqual(registro, []);
  });
  test('HU14-CN-C04 V1+V2+V3+V5+V8: con sesión y cuenta abierta, getHome responde', async () => {
    const registro = [];
    const db = new FirestoreFalso({'users/u-victor': {name: 'Víctor', merit: 1000}});
    assert.deepEqual(await endpoints(db, registro).getHome.run({...sesion(), data: {}}), {word: {text: 'ink'}, wordDay: 20773});
    assert.deepEqual(registro, ['getHome']);
  });
  test('HU14-CN-C05 V4+V6: cuenta recién registrada (sin documento) puede actualizar su perfil', async () => {
    const registro = [];
    assert.deepEqual(await endpoints(new FirestoreFalso(), registro).updateProfile.run({...sesion(), data: {name: 'victor'}}), {updated: true});
    assert.deepEqual(registro, ['updateProfile:u-victor:victor']);
  });
  test('HU14-CN-C06 NV2: cuenta cerrada se rechaza aunque tenga token', async () => {
    const registro = [];
    const db = new FirestoreFalso({'users/u-victor': {name: 'Víctor', accountClosed: true}});
    await assert.rejects(endpoints(db, registro).getHome.run(sesion()), {code: 'permission-denied', message: 'Esta cuenta está cerrada.'});
    assert.deepEqual(registro, []);
  });
  test('HU14-CN-C07 NV3: con sesión pero sin datos, updateProfile responde invalid-argument', async () => {
    const registro = [];
    await assert.rejects(endpoints(new FirestoreFalso(), registro).updateProfile.run({...sesion(), data: null}), {code: 'invalid-argument', message: 'Nombre inválido.'});
    assert.deepEqual(registro, []);
  });
});
