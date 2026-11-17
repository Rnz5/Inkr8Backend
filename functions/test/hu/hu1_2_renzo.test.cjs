// =====================================================================================
// HU 1.2 · Username único · Responsable: Renzo Ubaldo Adrianzén Vía
// Ejecutar:  npm run test:hu:renzo   (desde la carpeta functions)
//
//  CB  FirebaseUserRepository.updateName    src/data/repository/firebaseUserRepository.ts:34   V(G) = 8
//  CN  Registrar username (updateName)      Entradas (5): texto del username, uid, estado del perfil,
//                                           username previo del usuario, dueño actual del username.
//  UT  UpdateUserName.execute               src/domain/usecase/contentUseCases.ts:22   (6 casos, repositorio espía)
//
// Esperados derivados del criterio de HU 1.2: el username es único (sin distinguir mayúsculas), queda
// asociado permanentemente a la cuenta y, si ya está en uso, se informa "Username X is already in use".
// =====================================================================================
const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const {FirebaseUserRepository} = require('../../lib/data/repository/firebaseUserRepository');
const {UpdateUserName} = require('../../lib/domain/usecase/contentUseCases');
const {FirestoreFalso, claveUsername, relojFijo} = require('./apoyo/firestoreFalso.cjs');

const reloj = relojFijo('2026-11-16T15:00:00Z');
const perfil = (extra = {}) => ({name: 'Renzo', email: 'r@example.test', merit: 1000, rating: 0, seasonIndex: 2, league: 1, ...extra});
const guardar = (db, uid, nombre) => new FirebaseUserRepository(db, reloj).updateName(uid, nombre);
const MSG_PERFIL = {code: 'permission-denied', message: 'Perfil no disponible.'};
const MSG_PERMANENTE = {code: 'failed-precondition', message: 'Tu username está asociado permanentemente a tu cuenta.'};

// ---------- CAJA BLANCA: updateName (incluye la función de la transacción) ----------
// d1 !snapshot.exists   d2 || accountClosed === true
// d3 claim.exists       d4 && claim.userId !== id
// d5 previous           d6 && previous !== name
// d7 seasonIndex !== MIN_SAFE_INTEGER            -> V(G) = 7 + 1 = 8
describe('HU 1.2 · Renzo · Caja blanca · updateName', () => {
  test('HU12-CB-C01 camino 1: d1 V (perfil inexistente) -> Perfil no disponible', async () => {
    await assert.rejects(guardar(new FirestoreFalso(), 'u1', 'renzo'), MSG_PERFIL);
  });
  test('HU12-CB-C02 camino 2: d1 F, d2 V (cuenta cerrada) -> Perfil no disponible', async () => {
    await assert.rejects(guardar(new FirestoreFalso({'users/u1': perfil({accountClosed: true})}), 'u1', 'renzo'), MSG_PERFIL);
  });
  test('HU12-CB-C03 camino 3: d3 V, d4 V (username de otro usuario) -> ya está en uso', async () => {
    const db = new FirestoreFalso({'users/u1': perfil(), [`usernames/${claveUsername('renzo')}`]: {userId: 'u2', username: 'renzo'}});
    await assert.rejects(guardar(db, 'u1', 'renzo'), {code: 'failed-precondition', message: 'Username renzo is already in use'});
    assert.equal(db.escrituras.length, 0);
  });
  test('HU12-CB-C04 camino 4: d3 V, d4 F, d5 V, d6 F, d7 V (vuelve a guardar su propio username)', async () => {
    const db = new FirestoreFalso({'users/u1': perfil({username: 'renzo'}), [`usernames/${claveUsername('renzo')}`]: {userId: 'u1', username: 'renzo'}});
    await guardar(db, 'u1', 'renzo');
    assert.equal(db.leer('users/u1').username, 'renzo');
    assert.ok(db.leer('seasons/s2/members/u1'));
  });
  test('HU12-CB-C05 camino 5 (base): d3 F, d5 F, d7 V (primer username) -> reserva y actualiza perfil y ranking', async () => {
    const db = new FirestoreFalso({'users/u1': perfil()});
    await guardar(db, 'u1', 'renzo');
    assert.deepEqual(db.leer(`usernames/${claveUsername('renzo')}`), {userId: 'u1', username: 'renzo'});
    assert.deepEqual(db.leer('users/u1'), {...perfil(), name: 'renzo', username: 'renzo', league: 1});
    assert.deepEqual(db.leer('seasons/s2/members/u1'), {userId: 'u1', name: 'renzo', rating: 0, league: 1});
  });
  test('HU12-CB-C06 camino 6: d5 V, d6 V (ya tenía otro username) -> asociado permanentemente', async () => {
    await assert.rejects(guardar(new FirestoreFalso({'users/u1': perfil({username: 'antiguo'})}), 'u1', 'renzo'), MSG_PERMANENTE);
  });
  test('HU12-CB-C07 camino 7: d7 F (perfil sin temporada) -> guarda sin escribir en el ranking', async () => {
    const sinTemporada = perfil(); delete sinTemporada.seasonIndex;
    const db = new FirestoreFalso({'users/u1': sinTemporada});
    await guardar(db, 'u1', 'renzo');
    assert.equal(db.leer('users/u1').username, 'renzo');
    assert.equal(db.escrituras.some((w) => w.path.includes('/members/')), false);
  });
  test('HU12-CB-C08 camino 8: d3 F, d5 V, d6 F (username propio sin reserva previa) -> recrea la reserva', async () => {
    const db = new FirestoreFalso({'users/u1': perfil({username: 'renzo'})});
    await guardar(db, 'u1', 'renzo');
    assert.deepEqual(db.leer(`usernames/${claveUsername('renzo')}`), {userId: 'u1', username: 'renzo'});
  });
});

// ---------- CAJA NEGRA: registrar username ----------
// E1 texto:            V1 2 visibles (límite) | V2 20 (límite) | NV1 1 visible | NV2 21 | NV3 carácter de control
// E2 uid:              V3 uid del usuario autenticado
// E3 estado del perfil: V4 abierto | NV4 cerrado
// E4 username previo:  V5 ninguno | V6 el mismo | NV5 otro distinto
// E5 dueño actual:     V7 libre | V8 el mismo usuario | NV6 otro usuario (sin distinguir mayúsculas ni ancho NFKC)
const MSG_LONGITUD = {code: 'invalid-argument', message: 'El nombre debe tener entre 2 y 20 caracteres visibles.'};
describe('HU 1.2 · Renzo · Caja negra · username único', () => {
  test('HU12-CN-C01 V1+V3+V4+V5+V7: 2 caracteres visibles se aceptan', async () => {
    const db = new FirestoreFalso({'users/u1': perfil()});
    await guardar(db, 'u1', 'Al');
    assert.equal(db.leer('users/u1').username, 'Al');
  });
  test('HU12-CN-C02 V2: 20 caracteres se aceptan', async () => {
    const db = new FirestoreFalso({'users/u1': perfil()});
    await guardar(db, 'u1', 'a'.repeat(20));
    assert.equal(db.leer('users/u1').username, 'a'.repeat(20));
  });
  test('HU12-CN-C03 NV1: 1 carácter visible (aunque tenga espacios alrededor) se rechaza', async () => {
    const db = new FirestoreFalso({'users/u1': perfil()});
    await assert.rejects(guardar(db, 'u1', 'A'), MSG_LONGITUD);
    await assert.rejects(guardar(db, 'u1', ' A '), MSG_LONGITUD);
  });
  test('HU12-CN-C04 NV2: 21 caracteres se rechazan', async () => {
    await assert.rejects(guardar(new FirestoreFalso({'users/u1': perfil()}), 'u1', 'a'.repeat(21)), MSG_LONGITUD);
  });
  test('HU12-CN-C05 NV3: un carácter de control se rechaza', async () => {
    await assert.rejects(guardar(new FirestoreFalso({'users/u1': perfil()}), 'u1', 'renzo\u0007'), MSG_LONGITUD);
  });
  test('HU12-CN-C06 NV6: "Ana" tomado por otro bloquea "ana" y "ＡＮＡ" (ancho completo)', async () => {
    const db = new FirestoreFalso({'users/u1': perfil(), [`usernames/${claveUsername('Ana')}`]: {userId: 'u2', username: 'Ana'}});
    await assert.rejects(guardar(db, 'u1', 'ana'), {code: 'failed-precondition', message: 'Username ana is already in use'});
    await assert.rejects(guardar(db, 'u1', 'ＡＮＡ'), {code: 'failed-precondition', message: 'Username ＡＮＡ is already in use'});
  });
  test('HU12-CN-C07 V6+V8: volver a guardar el mismo username es idempotente', async () => {
    const db = new FirestoreFalso({'users/u1': perfil({username: 'renzo'}), [`usernames/${claveUsername('renzo')}`]: {userId: 'u1', username: 'renzo'}});
    await guardar(db, 'u1', 'renzo');
    assert.equal(db.leer('users/u1').username, 'renzo');
  });
  test('HU12-CN-C08 NV5: con username asignado no se puede cambiar por otro', async () => {
    await assert.rejects(guardar(new FirestoreFalso({'users/u1': perfil({username: 'renzo'})}), 'u1', 'renzo2'), MSG_PERMANENTE);
  });
  test('HU12-CN-C09 NV4: cuenta cerrada no puede registrar username', async () => {
    await assert.rejects(guardar(new FirestoreFalso({'users/u1': perfil({accountClosed: true})}), 'u1', 'renzo'), MSG_PERFIL);
  });
});

// ---------- PRUEBA UNITARIA: UpdateUserName.execute ----------
function repositorioEspia(error) {
  const llamadas = [];
  return {llamadas, updateName: async (...args) => { llamadas.push(args); if (error) throw error; }};
}
describe('HU 1.2 · Renzo · Unitaria · UpdateUserName.execute', () => {
  test('HU12-UT-C01 recorta espacios y delega una vez con el nombre recortado', async () => {
    const repo = repositorioEspia();
    await new UpdateUserName(repo).execute('u1', '  writer10  ');
    assert.deepEqual(repo.llamadas, [['u1', 'writer10']]);
  });
  test('HU12-UT-C02 nombre de 1 carácter: lanza invalid-argument y no llama al repositorio', async () => {
    const repo = repositorioEspia();
    await assert.rejects(new UpdateUserName(repo).execute('u1', 'a'), MSG_LONGITUD);
    assert.equal(repo.llamadas.length, 0);
  });
  test('HU12-UT-C03 nombre de 21 caracteres: rechazado sin llamar al repositorio', async () => {
    const repo = repositorioEspia();
    await assert.rejects(new UpdateUserName(repo).execute('u1', 'b'.repeat(21)), MSG_LONGITUD);
    assert.equal(repo.llamadas.length, 0);
  });
  test('HU12-UT-C04 22 caracteres con espacios que recortados son 20: se acepta', async () => {
    const repo = repositorioEspia();
    await new UpdateUserName(repo).execute('u1', ` ${'c'.repeat(20)} `);
    assert.deepEqual(repo.llamadas, [['u1', 'c'.repeat(20)]]);
  });
  test('HU12-UT-C05 carácter de control: rechazado sin llamar al repositorio', async () => {
    const repo = repositorioEspia();
    await assert.rejects(new UpdateUserName(repo).execute('u1', 'ab\u0000c'), MSG_LONGITUD);
    assert.equal(repo.llamadas.length, 0);
  });
  test('HU12-UT-C06 "ya está en uso" del repositorio se propaga intacto', async () => {
    const error = Object.assign(new Error('Username ana is already in use'), {code: 'failed-precondition'});
    await assert.rejects(new UpdateUserName(repositorioEspia(error)).execute('u1', 'ana'), error);
  });
});
