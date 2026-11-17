// =====================================================================================
// HU 1.6 · Frase de ejemplo · Responsable: Pedro Iván Pacheco Castro
// Ejecutar:  npm run test:hu:pedro   (desde la carpeta functions)
//
//  CB  HomeViewModel.showExample   (Android) -> app/src/test/java/com/inkr8/hu/Hu16PedroTest.kt   V(G) = 6
//  CN  Obtener la frase de ejemplo del día: GetWordExample + FirebaseContentRepository (datos en Firestore)
//      Entradas (7): día solicitado, palabra (text), frase (sentence), definition, phonetic, partOfSpeech, rarity.
//  UT  GetWordExample.execute   src/domain/usecase/contentUseCases.ts:45   (6 casos, repositorio y reloj falsos)
//
// Esperados derivados de HU 1.6: la frase debe contener la palabra del momento como palabra completa;
// si no se puede mostrar, el mensaje es "No se pudo cargar el ejemplo. Por favor, intenta de nuevo".
// =====================================================================================
const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const {FirebaseContentRepository} = require('../../lib/data/repository/firebaseContentRepository');
const {GetWordExample} = require('../../lib/domain/usecase/contentUseCases');
const {FirestoreFalso, relojFijo} = require('./apoyo/firestoreFalso.cjs');

const reloj = relojFijo('2026-11-16T15:00:00Z'); // día 20773
const palabra = (extra = {}) => ({text: 'ink', definition: 'Colored fluid', sentence: 'I spilled ink on the page.', phonetic: '/ɪŋk/', partOfSpeech: 'noun', rarity: 'Common', ...extra});
const ejemplo = (db, day) => new GetWordExample(new FirebaseContentRepository(db), reloj).execute(day);
const MSG_EJEMPLO = {code: 'failed-precondition', message: 'No se pudo cargar el ejemplo. Por favor, intenta de nuevo'};

// ---------- CAJA NEGRA: frase de ejemplo del día ----------
// E1 día:       V1 indicado (20773) | V2 omitido -> día del reloj
// E2 sentence:  V3 contiene la palabra completa (incluye mayúsculas y puntuación) | NV1 vacía | NV2 solo como parte de otra palabra
// E3 text:      V4 palabra normal | V5 con caracteres especiales de regex ("c++")
// E4-E7 metadatos (definition, phonetic, partOfSpeech, rarity): V6 completos | NV3 alguno vacío y sin respaldo en el catálogo
//                                                              | V7 alguno vacío pero el catálogo tiene la palabra completa
describe('HU 1.6 · Pedro · Caja negra · frase de ejemplo', () => {
  test('HU16-CN-C01 V1+V3+V4+V6: día indicado con frase válida devuelve la frase', async () => {
    assert.deepEqual(await ejemplo(new FirestoreFalso({'dailyWords/20773': palabra()}), 20773), {sentence: 'I spilled ink on the page.'});
  });
  test('HU16-CN-C02 V2: sin día, usa el día del reloj (20773)', async () => {
    assert.deepEqual(await ejemplo(new FirestoreFalso({'dailyWords/20773': palabra()}), undefined), {sentence: 'I spilled ink on the page.'});
  });
  test('HU16-CN-C03 V3: la palabra con mayúscula y seguida de puntuación cuenta como contenida', async () => {
    const db = new FirestoreFalso({'dailyWords/20773': palabra({sentence: 'Ink, paper and time.'})});
    assert.deepEqual(await ejemplo(db, 20773), {sentence: 'Ink, paper and time.'});
  });
  test('HU16-CN-C04 NV1: frase vacía -> mensaje de HU 1.6', async () => {
    await assert.rejects(ejemplo(new FirestoreFalso({'dailyWords/20773': palabra({sentence: '   '})}), 20773), MSG_EJEMPLO);
  });
  test('HU16-CN-C05 NV2: "art" dentro de "party" no cuenta como ejemplo', async () => {
    const db = new FirestoreFalso({'dailyWords/20773': palabra({text: 'art', sentence: 'The party started late.'})});
    await assert.rejects(ejemplo(db, 20773), MSG_EJEMPLO);
  });
  test('HU16-CN-C06 V5: palabra con caracteres especiales ("c++") se reconoce literalmente', async () => {
    const db = new FirestoreFalso({'dailyWords/20773': palabra({text: 'c++', sentence: 'I write c++ every day.'})});
    assert.deepEqual(await ejemplo(db, 20773), {sentence: 'I write c++ every day.'});
  });
  test('HU16-CN-C07 NV3: metadato en blanco (rarity) sin respaldo en el catálogo -> error de información incompleta', async () => {
    const db = new FirestoreFalso({'dailyWords/20773': palabra({rarity: '  '}),
      'words/w1': {word: 'quill', definition: 'Pen', sentence: 'A quill pen.', phonetic: '/kwɪl/', partOfSpeech: 'noun', rarity: 'Rare', isActive: true}});
    await assert.rejects(ejemplo(db, 20773), {code: 'failed-precondition', message: 'La palabra del momento no tiene su información completa.'});
  });
  test('HU16-CN-C08 V7: metadato vacío pero la palabra completa está en el catálogo -> se repara y muestra la frase', async () => {
    const db = new FirestoreFalso({'dailyWords/20773': palabra({phonetic: ''}),
      'words/w1': {word: 'ink', definition: 'Colored fluid', sentence: 'I spilled ink on the page.', phonetic: '/ɪŋk/', partOfSpeech: 'noun', rarity: 'Common', isActive: true}});
    assert.deepEqual(await ejemplo(db, 20773), {sentence: 'I spilled ink on the page.'});
    assert.equal(db.leer('dailyWords/20773').phonetic, '/ɪŋk/');
  });
});

// ---------- PRUEBA UNITARIA: GetWordExample.execute ----------
function contenidoEspia(respuesta) {
  const dias = [];
  return {dias, dailyWord: async (day) => { dias.push(day); if (respuesta instanceof Error) throw respuesta; return respuesta; }};
}
describe('HU 1.6 · Pedro · Unitaria · GetWordExample.execute', () => {
  test('HU16-UT-C01 con día indicado pide esa palabra y devuelve solo la frase', async () => {
    const repo = contenidoEspia(palabra());
    assert.deepEqual(await new GetWordExample(repo, reloj).execute(5), {sentence: 'I spilled ink on the page.'});
    assert.deepEqual(repo.dias, [5]);
  });
  test('HU16-UT-C02 sin día pide la palabra del día del reloj', async () => {
    const repo = contenidoEspia(palabra());
    await new GetWordExample(repo, reloj).execute();
    assert.deepEqual(repo.dias, [20773]);
  });
  test('HU16-UT-C03 día 0 es un día válido: no se reemplaza por el del reloj', async () => {
    const repo = contenidoEspia(palabra());
    await new GetWordExample(repo, reloj).execute(0);
    assert.deepEqual(repo.dias, [0]);
  });
  test('HU16-UT-C04 frase en blanco -> failed-precondition con el mensaje de HU 1.6', async () => {
    await assert.rejects(new GetWordExample(contenidoEspia(palabra({sentence: ''})), reloj).execute(1), MSG_EJEMPLO);
  });
  test('HU16-UT-C05 frase que no contiene la palabra -> failed-precondition', async () => {
    await assert.rejects(new GetWordExample(contenidoEspia(palabra({sentence: 'Nothing to see.'})), reloj).execute(1), MSG_EJEMPLO);
  });
  test('HU16-UT-C06 el error del repositorio se propaga intacto', async () => {
    const error = new Error('sin conexión');
    await assert.rejects(new GetWordExample(contenidoEspia(error), reloj).execute(1), error);
  });
});
