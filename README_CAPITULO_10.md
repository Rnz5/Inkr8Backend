# Inkr8 — pruebas del capítulo 10

Revisión y entrega del grupo con asistencia de IA declarada. La participación y reproducción individual requieren registro propio.

Node 20.19.0, npm 10.8.2, JDK21 y Firestore emulator1.22.0. Solo demo-inkr8/loopback.

`npm --prefix functions run test:coverage` ejecuta116 casos. `test:integration:coverage` ejecuta100 funcionales, incluidos Home observable y guardas de matchmaking. La concurrencia de50 está separada: `test:concurrency:coverage`; Run-Firestore.ps1 da una instancia nueva a cada suite y conserva ambos resultados.

`test:conformance:ac02` ejecuta6 casos, incluidos2 que demuestran la ausencia de recuperación automática429/503; esos fallos se conservan. La caracterización no aprueba el requisito.

En la copia con la propuesta de producto: `test:matching:policy` y `test:concurrency:odd` comprueban el desempate y51operaciones. Repetir también el perfil original50 con todas sus aserciones. Los parches de producto están separados de este parche de pruebas.

Los SDK OpenAI/evaluadores externos se sustituyen expresamente. No se certifica IA real ni ELO por caracterización. Ver README_Ejecucion.md del expediente para comandos, estados A/B/C y dependencias.
