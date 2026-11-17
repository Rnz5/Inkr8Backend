# Pruebas de la exposición — HU 1.1 a 1.6

Cada integrante tiene **sus tres pruebas** (caja blanca, caja negra y unitaria) sobre **su HU**, con su nombre en el archivo.
Todas usan código real del proyecto: no se modificó ningún archivo de producto.

| HU | Integrante | Caja blanca (V(G) > 4) | Caja negra (> 4 entradas) | Unitaria (≥ 4 casos) |
|---|---|---|---|---|
| 1.1 Registro con Google | Matías | `league` · V(G) = 6 · 6 casos | `FirebaseUserRepository.initialize` · 5 entradas · 6 casos | `InitializeUser.execute` · 5 casos |
| 1.2 Username único | Renzo | `FirebaseUserRepository.updateName` · V(G) = 8 · 8 casos | registrar username (`updateName`) · 5 entradas · 9 casos | `UpdateUserName.execute` · 6 casos |
| 1.3 Sesión persistente | Marco | `mapUser` · V(G) = 7 · 7 casos | `UserDto.read(...).toDomain()` (Android) · 7 entradas · 6 casos | `SessionViewModel` restauración (Android) · 5 casos |
| 1.4 Cierre de sesión | Víctor | `authenticated` · V(G) = 8 · 8 casos | acceso con y sin sesión (`contentHandlers`) · 5 entradas · 7 casos | `SessionViewModel.logout` (Android) · 5 casos |
| 1.5 Home / Palabra del momento | Jean Carlo | `FirebaseContentRepository.dailyWord` · V(G) = 9 · 8 casos (+1 camino infactible) | `WireMap.toHome()` (Android) · 11 entradas · 7 casos | `GetDailyHome.execute` · 5 casos |
| 1.6 Frase de ejemplo | Pedro | `HomeViewModel.showExample` (Android) · V(G) = 6 · 5 casos (+1 camino infactible) | frase del día (`GetWordExample` + Firestore) · 7 entradas · 8 casos | `GetWordExample.execute` · 6 casos |

Total: 117 casos (89 en el backend, 28 en Android).

## Dónde están

| Repositorio y rama | Archivo |
|---|---|
| Backend `Rnz5/Inkr8Backend`, rama `pruebas/capitulo-10` | `functions/test/hu/hu1_1_matias.test.cjs` … `hu1_6_pedro.test.cjs` y `functions/test/hu/apoyo/firestoreFalso.cjs` |
| Android `Matonga-Matonag/Inkr8Android`, rama `pruebas/capitulo-10` | `app/src/test/java/com/inkr8/hu/Hu13MarcoTest.kt`, `Hu14VictorTest.kt`, `Hu15JeanCarloTest.kt`, `Hu16PedroTest.kt` |

La rama `pruebas/capitulo-10` del backend tiene el mismo código de producto que la rama `Inkr8BackEnd`; la de Android, el mismo que `main`.

## Preparación (una sola vez, antes de la exposición)

### Backend (todos)
Requisitos: Git y **Node.js 20** (`node -v` debe mostrar v20.x).

```bash
git clone https://github.com/Rnz5/Inkr8Backend.git
cd Inkr8Backend
git checkout pruebas/capitulo-10
cd functions
npm ci
npm run test:hu
```

Debe terminar con `# pass 89` y `# fail 0`. Las pruebas usan un Firestore falso en memoria: no necesitan Java, emulador, internet ni credenciales de Firebase.

### Android (Marco, Víctor, Jean Carlo y Pedro)
Requisitos: Android Studio (trae el JDK 21). No hace falta `google-services.json` ni un celular o emulador: son pruebas JVM.

1. Clonar `https://github.com/Matonga-Matonag/Inkr8Android.git` y cambiar a la rama `pruebas/capitulo-10` (en Android Studio: *Git → Branches → origin/pruebas/capitulo-10 → Checkout*).
2. Esperar a que termine el *Gradle sync* (la primera vez descarga dependencias: hacerlo con internet, antes de la exposición).
3. Ejecutar una vez tu prueba (ver abajo) para que quede compilada.

## Ejecución en vivo (lo que hace cada uno)

Desde `Inkr8Backend/functions`:

| Integrante | Comando del backend | Qué se ve |
|---|---|---|
| Matías | `npm run test:hu:matias` | 17 casos: CB league, CN registro, UT InitializeUser |
| Renzo | `npm run test:hu:renzo` | 23 casos: CB updateName, CN username único, UT UpdateUserName |
| Marco | `npm run test:hu:marco` | 7 casos: CB mapUser |
| Víctor | `npm run test:hu:victor` | 15 casos: CB authenticated, CN acceso con/sin sesión |
| Jean Carlo | `npm run test:hu:jeancarlo` | 13 casos: CB dailyWord, UT GetDailyHome |
| Pedro | `npm run test:hu:pedro` | 14 casos: CN frase del día, UT GetWordExample |

Desde la raíz de `Inkr8Android` (terminal de Android Studio):

| Integrante | Comando | Casos |
|---|---|---|
| Marco | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu13MarcoTest"` | CN UserDto (6) + UT SessionViewModel (5) |
| Víctor | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu14VictorTest"` | UT logout (5) |
| Jean Carlo | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu15JeanCarloTest"` | CN toHome (7) |
| Pedro | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu16PedroTest"` | CB showExample (5) |

Alternativa en Android Studio: abrir el archivo `HuXX…Test.kt` y pulsar el triángulo verde junto a `class` → *Run*. El panel inferior muestra cada caso en verde. Informe HTML: `app/build/reports/tests/testDebugUnitTest/index.html`.

En Mac/Linux, usar `./gradlew` en lugar de `.\gradlew.bat`.

## Cómo explicar cada prueba (guion de 1 minuto)

1. **Caja blanca**: abrir el método en el código, señalar cada decisión (`if`, `&&`, `||`, `??`, `?.`, ternario, `catch`), decir V(G) = decisiones + 1, mostrar el grafo de la diapositiva y decir qué caso recorre cada camino (el nombre de cada prueba dice el camino: `camino 3: d3 V, d4 V`).
2. **Caja negra**: nombrar las entradas, las clases válidas (V) y no válidas (NV) que están en el comentario del archivo, y mostrar que cada caso indica las clases que cubre (`HU12-CN-C06 NV6`). Los esperados salen del criterio de aceptación, no del código.
3. **Unitaria**: explicar qué unidad se aísla y con qué doble de prueba (repositorio espía o falso, reloj fijo), y qué verifica cada caso (llamadas, resultado, error propagado).
4. **Ejecutar** el comando y mostrar el resumen `pass`/`fail` (o los checks verdes de Android Studio).

Para demostrar que la prueba sí detecta errores (si el profesor lo pide): cambiar en `src` un `<` por `<=` o un mensaje, volver a ejecutar, mostrar el caso en rojo y deshacer el cambio con `git checkout -- src`.

## Si algo falla en vivo

| Síntoma | Solución |
|---|---|
| `npm` no reconocido / versión distinta de 20 | Instalar Node 20 LTS y abrir una terminal nueva. |
| `Cannot find module '../../lib/...'` | Ejecutar con `npm run …` (compila antes) y no con `node --test` directo. |
| Gradle: `SDK location not found` | Abrir el proyecto una vez en Android Studio (crea `local.properties`). |
| Gradle descarga y tarda | Haber corrido la prueba antes con internet; en vivo agregar `--offline`. |
| Pruebas de Android no aparecen | Verificar que la rama activa es `pruebas/capitulo-10`. |
