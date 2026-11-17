# Pruebas de la exposición — HU 1.1 a 1.6

Cada integrante tiene **sus tres pruebas** (caja blanca, caja negra y unitaria) sobre **su HU**, con su nombre en el archivo.
Todas usan código real del proyecto; no se modificó ningún archivo de producto. Se ejecutan desde la terminal de **Visual Studio Code**.

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

| Repositorio y rama | Archivos |
|---|---|
| Backend `Rnz5/Inkr8Backend`, rama `pruebas/capitulo-10` | `functions/test/hu/hu1_1_matias.test.cjs` … `hu1_6_pedro.test.cjs` y `functions/test/hu/apoyo/firestoreFalso.cjs` |
| Android `Matonga-Matonag/Inkr8Android`, rama `pruebas/capitulo-10` | `app/src/test/java/com/inkr8/hu/Hu13MarcoTest.kt`, `Hu14VictorTest.kt`, `Hu15JeanCarloTest.kt`, `Hu16PedroTest.kt` |

La rama `pruebas/capitulo-10` del backend tiene el mismo código de producto que la rama `Inkr8BackEnd`; la de Android, el mismo que `main`.

## Preparación (una vez, con internet)

1. Instalar **Visual Studio Code**, **Git** y **Node.js LTS** (funciona con Node 20 y con versiones más nuevas; el aviso `EBADENGINE` se ignora).
   Quienes tienen pruebas Android (Marco, Víctor, Jean Carlo y Pedro) deben tener **Android Studio** instalado, solo por su Java y su SDK.
2. En VS Code: `Ctrl + Shift + P` → **Terminal: Select Default Profile** → **Command Prompt**. En Windows, la terminal PowerShell suele bloquear `npm`.
3. En la terminal (*Terminal → New Terminal*):

```bat
mkdir C:\Inkr8
cd /d C:\Inkr8
git clone -b pruebas/capitulo-10 https://github.com/Rnz5/Inkr8Backend.git
git clone -b pruebas/capitulo-10 https://github.com/Matonga-Matonag/Inkr8Android.git
cd /d C:\Inkr8\Inkr8Backend\functions
npm ci
npm run test:hu
```

Debe terminar con `ℹ pass 89` y `ℹ fail 0`. Las pruebas del backend usan un Firestore falso en memoria: no necesitan emulador, Java ni credenciales de Firebase.

## Ejecución en vivo

### Backend (desde `C:\Inkr8\Inkr8Backend\functions`)

| Integrante | Comando | Casos |
|---|---|---|
| Matías | `npm run test:hu:matias` | 17: CB league, CN registro, UT InitializeUser |
| Renzo | `npm run test:hu:renzo` | 23: CB updateName, CN username único, UT UpdateUserName |
| Marco | `npm run test:hu:marco` | 7: CB mapUser |
| Víctor | `npm run test:hu:victor` | 15: CB authenticated, CN acceso con y sin sesión |
| Jean Carlo | `npm run test:hu:jeancarlo` | 13: CB dailyWord, UT GetDailyHome |
| Pedro | `npm run test:hu:pedro` | 14: CN frase del día, UT GetWordExample |

### Android (desde `C:\Inkr8\Inkr8Android`)

Una vez por cada terminal nueva (rutas de una instalación normal de Android Studio):

```bat
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
```

| Integrante | Comando | Casos |
|---|---|---|
| Marco | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu13MarcoTest" --rerun` | CN UserDto (6) + UT SessionViewModel (5) |
| Víctor | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu14VictorTest" --rerun` | UT logout (5) |
| Jean Carlo | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu15JeanCarloTest" --rerun` | CN toHome (7) |
| Pedro | `.\gradlew.bat :app:testDebugUnitTest --tests "com.inkr8.hu.Hu16PedroTest" --rerun` | CB showExample (5) |

Debe salir `BUILD SUCCESSFUL`. Para ver cada caso: `start app\build\reports\tests\testDebugUnitTest\index.html`.
`--rerun` obliga a ejecutar la prueba aunque ya se haya corrido antes; sin él, Gradle responde `UP-TO-DATE` y no la ejecuta. La primera ejecución descarga dependencias y tarda de 3 a 5 minutos.

## Demostrar que la prueba detecta errores

Cambiar algo en el código (por ejemplo, en `functions/src/domain/policy/gamePolicy.ts`, `rating < 30` por `rating <= 30`), volver a correr el comando, mostrar el caso en rojo (`✖ HU11-CB-C02`) y deshacer el cambio con `git checkout -- src` (en Android, `git checkout -- app/src/main`).

## Si algo falla

| Síntoma | Solución |
|---|---|
| `npm.ps1 no se puede cargar… ejecución de scripts deshabilitada` | Cambiar la terminal de VS Code a Command Prompt. |
| `'git' / 'node' / 'npm' no se reconoce` | Instalar el programa y reiniciar VS Code. |
| `Cannot find module '../../lib/...'` | Ejecutar con `npm run …` (compila antes) y no con `node --test` directo. |
| `'gradlew.bat' no se reconoce` | Escribir `.\gradlew.bat` desde la carpeta `Inkr8Android`. |
| `JAVA_HOME is set to an invalid directory` / `SDK location not found` | Revisar las dos líneas `set` (Android Studio → Settings → Gradle JDK y Android SDK muestran las rutas). |
| Gradle responde `UP-TO-DATE` | Agregar `--rerun`. |
