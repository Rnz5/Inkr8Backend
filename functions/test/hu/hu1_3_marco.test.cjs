// =====================================================================================
// HU 1.3 · Sesión persistente · Responsable: Marco Antonio Bocanegra Carrión
// Ejecutar:  npm run test:hu:marco   (desde la carpeta functions)
//
//  CB  mapUser(id, dto)     src/data/dto/userDto.ts:3     V(G) = 7      <- este archivo (backend)
//      Se ejecuta cada vez que la app se reabre con la sesión guardada: SessionViewModel.refresh llama a
//      initializeUser, que encuentra el perfil existente y lo reconstruye con mapUser (por eso el usuario
//      vuelve a ver su mérito, rating y username sin iniciar sesión otra vez).
//  CN  UserDto.read(id, map).toDomain()   (Android)  -> app/src/test/java/com/inkr8/hu/Hu13MarcoTest.kt
//  UT  SessionViewModel (restauración)    (Android)  -> app/src/test/java/com/inkr8/hu/Hu13MarcoTest.kt
// =====================================================================================
const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const {mapUser} = require('../../lib/data/dto/userDto');

// return {id, name: dto.name || "Writer", email: dto.email ?? null, merit: dto.merit ?? 0,
//         rating: dto.rating ?? 0, seasonIndex: dto.seasonIndex ?? MIN_SAFE_INTEGER, username: dto.username ?? null}
// Decisiones: d1 || (name)  d2 ?? (email)  d3 ?? (merit)  d4 ?? (rating)  d5 ?? (seasonIndex)  d6 ?? (username)
// V(G) = 6 + 1 = 7. Camino base: todos los campos presentes; cada camino siguiente invierte una decisión.
const guardado = {name: 'Marco', email: 'marco@example.test', merit: 1250, rating: 64, seasonIndex: 2, username: 'marco'};
const restaurado = {id: 'u-marco', ...guardado};
const sin = (campo) => { const copia = {...guardado}; delete copia[campo]; return copia; };

describe('HU 1.3 · Marco · Caja blanca · mapUser', () => {
  test('HU13-CB-C01 camino 1 (base): perfil completo se restaura tal cual', () => {
    assert.deepEqual(mapUser('u-marco', guardado), restaurado);
  });
  test('HU13-CB-C02 camino 2: d1 usa el valor por defecto (nombre vacío -> "Writer")', () => {
    assert.deepEqual(mapUser('u-marco', {...guardado, name: ''}), {...restaurado, name: 'Writer'});
  });
  test('HU13-CB-C03 camino 3: d2 usa el valor por defecto (sin email -> null)', () => {
    assert.deepEqual(mapUser('u-marco', sin('email')), {...restaurado, email: null});
  });
  test('HU13-CB-C04 camino 4: d3 usa el valor por defecto (sin mérito -> 0)', () => {
    assert.deepEqual(mapUser('u-marco', sin('merit')), {...restaurado, merit: 0});
  });
  test('HU13-CB-C05 camino 5: d4 usa el valor por defecto (sin rating -> 0)', () => {
    assert.deepEqual(mapUser('u-marco', sin('rating')), {...restaurado, rating: 0});
  });
  test('HU13-CB-C06 camino 6: d5 usa el valor por defecto (sin temporada -> MIN_SAFE_INTEGER)', () => {
    assert.deepEqual(mapUser('u-marco', sin('seasonIndex')), {...restaurado, seasonIndex: Number.MIN_SAFE_INTEGER});
  });
  test('HU13-CB-C07 camino 7: d6 usa el valor por defecto (sin username -> null)', () => {
    assert.deepEqual(mapUser('u-marco', sin('username')), {...restaurado, username: null});
  });
});
