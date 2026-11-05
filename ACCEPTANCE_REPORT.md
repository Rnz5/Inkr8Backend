# Criterios de Aceptación de Inkr8 (ASR_Inkr8.xlsx)

Este documento detalla la implementación integral y verificación técnica de los **60 criterios de aceptación** (uno de éxito y uno de fallo por cada una de las 30 historias de usuario) especificados en la hoja *"Historias de Usuario"* del archivo [ASR_Inkr8.xlsx](file:///d:/UNIVERSIDAD/Cursos/Cursos%202026-2/Ingenier%C3%ADa%20de%20Software%20II/Proyecto/Repositorio/ASR_Inkr8.xlsx).

Todos los criterios se encuentran implementados tanto a nivel de lógica de dominio y backend como en los componentes visuales de Jetpack Compose, respaldados por la suite de pruebas `AcceptanceCriteriaSuiteTest.kt` y el diálogo de demostración interactiva `AcceptanceShowcaseDialog.kt`.

---

## 1. Tabla de Cobertura de las 30 Historias de Usuario (60 Criterios)

| ID | Historia de Usuario | Escenario 1 (Éxito) | Escenario 2 (Fallo) | Implementación en Código |
|---|---|---|---|---|
| **HU 1.1** | Registro con Google | Selecciona "Continuar con Google" e inicializa el perfil con 1000 Merit redirigiendo a la pantalla principal. | Fallo de autenticación con Google: impide el acceso y muestra `"Google sign-in failed. Please try again"`. | `LoginScreen.kt`, `SessionViewModel.kt`, `FirebaseAuthRepository.kt`, `AcceptanceMessages.kt` |
| **HU 1.2** | Username único | Guarda y asocia permanentemente el username a la cuenta. | Username duplicado: impide registro y muestra `"Username <USERNAME> is already in use"`. | `ProfileScreen.kt`, `ProfileViewModel.kt`, `firebaseUserRepository.ts` |
| **HU 1.3** | Sesión persistente | Sesión activa previa restaura automáticamente y dirige a Home. | Sesión cerrada previamente abre pantalla de Login. | `SessionViewModel.kt`, `MainActivity.kt`, `FirebaseAuthRepository.kt` |
| **HU 1.4** | Cierre de sesión manual | Clic en "Log out" finaliza sesión y redirige al Login. | Fallo al cerrar sesión muestra `"Error when logging out. Please try again"`. | `ProfileScreen.kt`, `SessionViewModel.kt`, `FirebaseAuthRepository.kt` |
| **HU 1.5** | Pantalla Home (Word of Moment) | Carga palabra con pronunciación, tipo, rareza, definición, botón audio y botón ejemplo. | Sin conexión al ingresar: muestra `"The Word of the Moment could not be loaded. Please check your connection"` y reintento. | `HomeScreen.kt`, `HomeViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 1.6** | Oración de ejemplo | Clic en "Show example sentence" muestra oración que incluye la palabra del momento. | Servidor no responde: muestra `"The example could not be loaded. Please try again"`. | `HomeScreen.kt`, `HomeViewModel.kt`, `GetWordExample.kt` |
| **HU 1.7** | Historial de partidas | Listado cronológico con puntaje, modo de juego, fecha y resultado. | Fallo de carga: muestra `"The game history could not be loaded"`. | `ProfileScreen.kt`, `GameScreen.kt`, `GameViewModel.kt`, `ProfileViewModel.kt` |
| **HU 1.8** | Resumen de rendimiento en perfil | Métricas: partidas jugadas, promedio puntuación, mejor puntaje y % victorias. | Fallo al recuperar estadísticas: muestra `"Performance data could not be retrieved"`. | `ProfileScreen.kt`, `ProfileViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 1.9** | Actualización de estadísticas tras evaluación | Resultados de partida evaluada actualizan automáticamente el perfil. | Fallo en actualización: muestra `"The update could not be completed"`. | `MainScreen.kt`, `ProfileViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 1.10** | Persistencia de progreso | Progreso, historial y estadísticas se conservan al reingresar tras cerrar sesión. | Fallo al recuperar datos almacenados al ingresar: muestra `"We were unable to retrieve your progress information. Please try again"`. | `SessionViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 2.1** | Restricciones activas en escritura | Muestra cuatro restricciones activas (límite palabras y 4 palabras requeridas). | Sin conexión: muestra `"The action cannot be performed. Please check your Internet connection"` y botón reintentar. | `GameScreen.kt`, `GameViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 2.2** | Editor de texto y Submit | Redacción válida habilita botón "Submit" y envía texto al backend. | Texto menor al mínimo o vacío: botón bloqueado y mensaje `"Your text does not meet the requirements"`. | `GameScreen.kt`, `GameViewModel.kt`, `GamePolicy.kt` |
| **HU 2.3** | Evaluación automática R8 | R8 asigna puntuación 0-100 basada en coherencia, vocabulario, creatividad y reglas. | Timeout de evaluación: muestra `"The evaluation is taking longer than expected. We'll let you know when your results are ready"` y reintento en cola. | `GameScreen.kt`, `firebaseGameRepository.ts`, `evaluationPolicy.ts` |
| **HU 2.4** | Feedback detallado | Pantalla de resultados muestra puntaje, restricciones cumplidas y comentarios específicos. | Error de estructura: conserva puntaje base y muestra `"The detailed feedback could not be loaded at this time"`. | `GameScreen.kt`, `DomainMappers.kt`, `AcceptanceMessages.kt` |
| **HU 2.5** | Modo Práctica aislado | Práctica libre evaluada de inmediato sin afectar estadísticas ni historial competitivo. | Sin conexión en práctica: muestra `"The action could not be loaded. Please check your connection"` y botón reintentar. | `GameScreen.kt`, `GameViewModel.kt`, `firebaseProgressRepository.ts` |
| **HU 3.1** | Saldo de Merit en perfil | Acceso a perfil recupera y muestra saldo actual de Merit. | Fallo de conexión: muestra `"We were unable to load your Merit balance. Please check your internet connection"`. | `ProfileScreen.kt`, `ProfileViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 3.2** | Recompensa de Merit al completar partida | Acredita automáticamente monto de Merit ganado y lo muestra en pantalla (+X Merit). | Fallo de servidor al acreditar: muestra `"Unable to connect to the server"`. | `GameScreen.kt`, `GameViewModel.kt`, `firebaseGameRepository.ts` |
| **HU 3.3** | Costo de entrada Ranked | Descuenta 100 Merit de saldo, actualiza total y permite acceso si saldo es suficiente. | Saldo insuficiente: bloquea acceso y muestra `"You don't have enough Merit to enter"`. | `HomeScreen.kt`, `GameScreen.kt`, `GameViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 3.4** | Acceso al modo Ranked | Clic en "Play Ranked" descuenta tarifa e inicia sesión competitiva. | Saldo insuficiente: detiene proceso y muestra `"The ranked match cannot be started. Insufficient Merit"`. | `HomeScreen.kt`, `GameViewModel.kt`, `firebaseGameRepository.ts` |
| **HU 3.5** | Cola asíncrona de matchmaking | Empareja con rival de rating similar (delta ≤ 30). | Sin rival tras 48h: resuelve encuentro contra puntuación promedio del jugador. | `matchmaker.ts`, `matchBaseline.ts`, `matchRecovery.ts` |
| **HU 3.6** | Rating actual en perfil | Accede a perfil y muestra rating competitivo actual. | Fallo al recuperar rating: muestra `"Server failure"`. | `ProfileScreen.kt`, `ProfileViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 3.7** | Actualización de rating post-partida | Aplica variación ELO al rating tras resolverse el encuentro. | Fallo al calcular rating: muestra `"The game ranking could not be updated"`. | `GameScreen.kt`, `firebaseMatchRepository.ts`, `AcceptanceMessages.kt` |
| **HU 3.8** | Visualización de resultado | Pantalla de resultados muestra Victoria, Derrota o Empate. | Fallo al obtener resultados: muestra `"The game result could not be updated"`. | `GameScreen.kt`, `AcceptanceMessages.kt` |
| **HU 3.9** | Variación de rating (+/-) | Muestra variación de puntos ganados o perdidos según diferencia de rating. | Fallo al calcular variación: muestra `"Server failure"`. | `GameScreen.kt`, `AcceptanceMessages.kt` |
| **HU 3.10** | Ranked On-Topic Writing | Inicia partida con reglas y restricciones de On-Topic (2 palabras + tema). | Fallo de carga al iniciar: muestra `"The On-Topic game could not be started. Please try again"`. | `GameScreen.kt`, `GameViewModel.kt`, `firebaseContentRepository.ts` |
| **HU 3.11** | Restricciones avanzadas On-Topic | Muestra tópico, límite de palabras y reglas avanzadas (primera persona, pregunta). | Fallo al recuperar restricciones: muestra `"The game restrictions could not be loaded"`. | `GameScreen.kt`, `GameViewModel.kt`, `firebaseContentRepository.ts` |
| **HU 3.12** | Validación automática de restricciones | R8 determina restricciones cumplidas e incumplidas en el texto. | Fallo en validación: muestra `"Compliance with restrictions could not be verified"`. | `GameScreen.kt`, `evaluationPolicy.ts`, `AcceptanceMessages.kt` |
| **HU 3.13** | Detalle de cumplimiento de restricciones | Pantalla de resultados muestra cada restricción cumplida o incumplida. | Error al recuperar detalle: muestra `"The restriction details could not be loaded"`. | `GameScreen.kt`, `DomainMappers.kt`, `AcceptanceMessages.kt` |
| **HU 3.14** | Ranking de temporada actual | Clasificación ordenada por rating y resalta la posición propia del jugador. | Fallo al recuperar: muestra `"The season standings could not be loaded"`. | `GameScreen.kt`, `RankingViewModel.kt`, `AcceptanceMessages.kt` |
| **HU 3.15** | Historial de temporadas anteriores | Consulta posición final, rating de cierre y Merit obtenido en temporadas pasadas. | Fallo al recuperar historial: muestra `"The season history could not be loaded"`. | `ProfileScreen.kt`, `ProfileViewModel.kt`, `AcceptanceMessages.kt` |

---

## 2. Demostración en Ejecución y Soporte de Evaluación

Para sustentar y presentar la aplicación en vivo ante evaluadores y docentes:
1. **Diálogo Interactivo `AcceptanceShowcaseDialog.kt`**:
   - En la cabecera de la aplicación se encuentra el botón **"Criterios AC"**.
   - Al pulsarlo, se despliega el catálogo de las 30 historias de usuario con la descripción de sus dos escenarios.
   - Cada escenario con mensaje canónico cuenta con el botón **"Demostrar Mensaje"**, el cual proyecta en ejecución el mensaje de fallo exacto en la interfaz, permitiendo evidenciar el comportamiento sin requerir cortes forzados de red ni manipulación manual de base de datos.
2. **Suite de Pruebas `AcceptanceCriteriaSuiteTest.kt`**:
   - 60 métodos de prueba unitarios e integrados independientes nombrados bajo el estándar `huX_X_scenario1_...` y `huX_X_scenario2_...`.
3. **Verificación de Arquitectura Limpia**:
   - El script `scripts/verify-architecture.ps1` valida automáticamente que no existan violaciones de fronteras entre `:domain`, `:app` y backend.
