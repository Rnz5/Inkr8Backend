# Inkr8 · Backend Serverless (Inkr8BackEnd)

Servidor backend para **Inkr8**, implementado sobre **Firebase Cloud Functions (TypeScript)**, **Cloud Firestore** y la **API de OpenAI (R8)**.

## Arquitectura del Backend

El backend sigue una arquitectura limpia desacoplada por capas:

```
Inkr8BackEnd/
├── firebase.json                 # Configuración del proyecto Firebase, Functions, Firestore y emuladores
├── firestore.rules               # Reglas de seguridad declarativas (RBAC y protección de integridad económica)
├── firestore.indexes.json        # Índices compuestos para consultas ordenadas y emparejamientos
├── scripts/
│   └── verify-architecture.ps1   # Verificación de fronteras arquitectónicas limpias
└── functions/
    ├── package.json              # Dependencias (firebase-admin, firebase-functions, openai)
    ├── tsconfig.json             # Configuración TypeScript strict
    ├── src/
    │   ├── index.ts              # Exportación centralizada de endpoints y triggers
    │   ├── data/                 # Repositorios Firestore, DTOs, mappers y evaluador OpenAI
    │   │   ├── repository/       # firebaseUserRepository, firebaseGameRepository, firebaseMatchRepository, etc.
    │   │   └── source/           # firestore.ts, openAiWritingEvaluator.ts, persistenceProvider.ts
    │   ├── domain/               # Lógica de negocio pura (independiente de Firebase y OpenAI)
    │   │   ├── model/            # Entidades y tipos (User, Game, Challenge, Evaluation, etc.)
    │   │   ├── policy/           # Políticas puras: evaluationPolicy, matchingPolicy, seasonPolicy, gamePolicy
    │   │   ├── repository/       # Contratos e interfaces de repositorios
    │   │   └── usecase/          # Casos de uso: StartGame, SubmitGame, EvaluateGame, GetDailyHome, etc.
    │   └── presentation/         # Handlers HTTP Callables y Schedulers
    │       ├── handlers/         # contentHandlers.ts, gameHandlers.ts, callables.ts
    │       └── scheduler/        # seasonScheduler.ts
    ├── test/
    │   └── domain.test.cjs       # Pruebas unitarias de dominio y políticas (17 tests)
    └── integration/
        └── firestore.test.cjs    # Pruebas de integración con emulador local de Firestore (17 tests)
```

---

## Funcionalidades Principales

1. **Autenticación e Identidad**:
   - Inicialización transaccional de perfiles de usuario (`initializeUser`) con saldo inicial de 1000 Merit y liga 1.
   - Reserva atómica de nombres de usuario únicos con normalización Unicode (`updateProfile`).
2. **Contenido Dinámico**:
   - Generación determinista y diaria de la palabra del momento (`getHome`, `getWordExample`) cambiando a medianoche UTC.
   - Retos de escritura Estándar (4 palabras) y On-Topic (2 palabras + tópico + restricciones avanzadas).
3. **Evaluación Automática con Inteligencia Artificial (R8)**:
   - Worker asíncrono (`gameEvaluationWorker`) que evalúa coherencia, vocabulario, creatividad y cumplimiento de restricciones mediante OpenAI.
   - Detección de timeouts a 90 segundos con sistema persistente de reintentos (`evaluationRecoveryScheduler`).
4. **Sistema Económico y Competitivo (Ranked)**:
   - Débito transaccional e idempotente de 100 Merit por entrada a partidas Ranked (`startGame`).
   - Recompensas automáticas e inmutables calculadas atómicamente al completarse la evaluación.
5. **Matchmaking Asíncrono ELO**:
   - Cola asíncrona de emparejamiento con diferencia máxima de 30 puntos de rating.
   - Resolución automática contra el promedio del jugador tras 48 horas sin rival.
6. **Temporadas Competitivas**:
   - Temporadas automáticas de 14 días UTC con reseteo de ligas y rating conservando el saldo de Merit.
   - Historial de temporadas anteriores y rankings estacionales.

---

## Ejecución Local y Pruebas

### 1. Compilación y Pruebas de Dominio
```powershell
cd functions
npm test
```

### 2. Pruebas de Integración con Emulador Firestore
```powershell
# En una terminal: iniciar emuladores
firebase emulators:start --only firestore

# En otra terminal: ejecutar pruebas
npm --prefix functions run test:integration
```

### 3. Verificación de Arquitectura
```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-architecture.ps1
```

---

## Integración con el Frontend (Inkr8Android)

El frontend Android se comunica con este backend de dos formas:
- **Llamadas HTTPS Callable**: Ejecutadas de forma autenticada usando el token JWT de Firebase Auth.
- **Listeners en Tiempo Real de Firestore**: El cliente observa documentos de partidas para actualizar en vivo el estado cuando R8 completa una evaluación o cuando se resuelve un emparejamiento.
