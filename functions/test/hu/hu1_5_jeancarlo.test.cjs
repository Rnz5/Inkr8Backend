// =====================================================================================
// HU 1.5 · Home / Palabra del momento · Responsable: Jean Carlo de Jesús Rado Delgado
// Ejecutar:  npm run test:hu:jeancarlo   (desde la carpeta functions)
//
//  CB  FirebaseContentRepository.dailyWord(day)   src/data/repository/firebaseContentRepository.ts:12   V(G) = 9
//  CN  WireMap.toHome()   (Android) -> app/src/test/java/com/inkr8/hu/Hu15JeanCarloTest.kt
//  UT  GetDailyHome.execute    src/domain/usecase/contentUseCases.ts:10   (5 casos, repositorio y reloj falsos)
// =====================================================================================
const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const {FirebaseContentRepository} = require('../../lib/data/repository/firebaseContentRepository');
const {GetDailyHome} = require('../../lib/domain/usecase/contentUseCases');
const {FirestoreFalso, relojFijo} = require('./apoyo/firestoreFalso.cjs');

const palabra = (texto, extra = {}) => ({text: texto, definition: `def ${texto}`, sentence: `Use ${texto} today.`, phonetic: `/${texto}/`, partOfSpeech: 'noun', rarity: 'Common', ...extra});
const catalogo = (...palabras) => Object.fromEntries(palabras.map((p, i) => [`words/w${i + 1}`,
  {word: p.text, definition: p.definition, sentence: p.sentence, phonetic: p.phonetic, partOfSpeech: p.partOfSpeech, rarity: p.rarity, isActive: true}]));
const del = (db, day) => new FirebaseContentRepository(db).dailyWord(day);
const MSG_INCOMPLETA = {code: 'failed-precondition', message: 'La palabra del momento no tiene su información completa.'};

// ---------- CAJA BLANCA: dailyWord (incluye la función de la transacción) ----------
// d1 saved.exists    d2 && hasMetadata(saved)    d3 !words.length    d4 saved.exists ? (buscar por texto : índice del día)
// d5 !word           d6 || !hasMetadata(word)    d7 current.exists   d8 && hasMetadata(current)
// V(G) = 8 + 1 = 9. d1 y d4 evalúan la misma condición: el camino "d1 F con d4 V" es infactible,
// por eso la base tiene 8 caminos ejecutables + 1 infactible documentado.
describe('HU 1.5 · Jean Carlo · Caja blanca · dailyWord', () => {
  test('HU15-CB-C01 camino 1 (base): sin palabra guardada, elige por día, la guarda y la devuelve', async () => {
    const db = new FirestoreFalso(catalogo(palabra('ink'), palabra('quill')));
    const w = await del(db, 3); // 3 % 2 = 1 -> segunda palabra del catálogo ordenado (w2 = quill)
    assert.deepEqual(w, palabra('quill'));
    assert.deepEqual(db.leer('dailyWords/3'), palabra('quill'));
  });
  test('HU15-CB-C02 camino 2: d1 V, d2 V (palabra del día completa) -> la devuelve sin leer el catálogo', async () => {
    const db = new FirestoreFalso({'dailyWords/7': palabra('ink')});
    assert.deepEqual(await del(db, 7), palabra('ink'));
    assert.equal(db.lecturasCatalogo, 0);
  });
  test('HU15-CB-C03 camino 3: d1 F, d3 V (catálogo vacío) -> "No hay palabras activas disponibles."', async () => {
    await assert.rejects(del(new FirestoreFalso(), 3), {code: 'failed-precondition', message: 'No hay palabras activas disponibles.'});
  });
  test('HU15-CB-C04 camino 4: d1 V, d2 F, d4 V, d7 V, d8 F (guardada incompleta) -> la repara desde el catálogo', async () => {
    const db = new FirestoreFalso({'dailyWords/7': {text: 'ink'}, ...catalogo(palabra('ink'), palabra('quill'))});
    assert.deepEqual(await del(db, 7), palabra('ink'));
    assert.deepEqual(db.leer('dailyWords/7'), palabra('ink'));
  });
  test('HU15-CB-C05 camino 5: d4 V, d5 V (la guardada no está en el catálogo) -> información incompleta', async () => {
    const db = new FirestoreFalso({'dailyWords/7': {text: 'ghost'}, ...catalogo(palabra('ink'))});
    await assert.rejects(del(db, 7), MSG_INCOMPLETA);
  });
  test('HU15-CB-C06 camino 6: d4 F, d5 F, d6 V (la elegida tiene la definición en blanco) -> información incompleta', async () => {
    const db = new FirestoreFalso(catalogo(palabra('ink', {definition: '   '})));
    await assert.rejects(del(db, 0), MSG_INCOMPLETA);
    assert.equal(db.leer('dailyWords/0'), undefined);
  });
  test('HU15-CB-C07 camino 7: d7 V, d8 V (otro proceso la guardó completa) -> devuelve esa sin sobrescribir', async () => {
    const db = new FirestoreFalso(catalogo(palabra('ink'), palabra('quill')));
    db.antesDeTransaccion = (d) => d.store.set('dailyWords/3', palabra('pen'));
    assert.deepEqual(await del(db, 3), palabra('pen'));
    assert.deepEqual(db.leer('dailyWords/3'), palabra('pen'));
  });
  test('HU15-CB-C08 camino 8: d1 F, d7 V, d8 F (otro proceso dejó una incompleta) -> la sobrescribe', async () => {
    const db = new FirestoreFalso(catalogo(palabra('ink'), palabra('quill')));
    db.antesDeTransaccion = (d) => d.store.set('dailyWords/3', {text: 'pen'});
    assert.deepEqual(await del(db, 3), palabra('quill'));
    assert.deepEqual(db.leer('dailyWords/3'), palabra('quill'));
  });
});

// ---------- PRUEBA UNITARIA: GetDailyHome.execute ----------
function contenidoEspia(respuesta) {
  const dias = [];
  return {dias, dailyWord: async (day) => { dias.push(day); if (respuesta instanceof Error) throw respuesta; return respuesta; }};
}
describe('HU 1.5 · Jean Carlo · Unitaria · GetDailyHome.execute', () => {
  test('HU15-UT-C01 16/11/2026 15:00 UTC -> día 20773 y pide esa palabra una sola vez', async () => {
    const repo = contenidoEspia(palabra('ink'));
    const home = await new GetDailyHome(repo, relojFijo('2026-11-16T15:00:00Z')).execute();
    assert.equal(home.wordDay, 20773);
    assert.deepEqual(repo.dias, [20773]);
    assert.deepEqual(home.word, palabra('ink'));
  });
  test('HU15-UT-C02 frontera de medianoche UTC: 23:59:59.999 es día 20773 y 00:00 es 20774', async () => {
    const antes = await new GetDailyHome(contenidoEspia(palabra('a')), relojFijo('2026-11-16T23:59:59.999Z')).execute();
    const despues = await new GetDailyHome(contenidoEspia(palabra('b')), relojFijo('2026-11-17T00:00:00.000Z')).execute();
    assert.equal(antes.wordDay, 20773);
    assert.equal(despues.wordDay, 20774);
  });
  test('HU15-UT-C03 incluye la temporada vigente (s2: 09/11 a 23/11/2026)', async () => {
    const home = await new GetDailyHome(contenidoEspia(palabra('ink')), relojFijo('2026-11-16T15:00:00Z')).execute();
    assert.deepEqual(home.season, {id: 's2', index: 2, start: 1794182400000, end: 1795392000000});
  });
  test('HU15-UT-C04 incluye el costo de la partida clasificatoria (100)', async () => {
    const home = await new GetDailyHome(contenidoEspia(palabra('ink')), relojFijo('2026-11-16T15:00:00Z')).execute();
    assert.equal(home.rankedCost, 100);
  });
  test('HU15-UT-C05 si no se puede obtener la palabra, el error se propaga', async () => {
    const error = Object.assign(new Error('No hay palabras activas disponibles.'), {code: 'failed-precondition'});
    await assert.rejects(new GetDailyHome(contenidoEspia(error), relojFijo('2026-11-16T15:00:00Z')).execute(), error);
  });
});
