package com.inkr8.presentation.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.inkr8.presentation.state.AcceptanceMessages

data class ShowcaseCriteria(
    val huId: String,
    val title: String,
    val scenario1Success: String,
    val scenario2Failure: String,
    val failureMessage: String?
)

object ShowcaseCatalog {
    val allCriteria = listOf(
        ShowcaseCriteria("HU 1.1", "Registro con Google",
            "Selecciona 'Continuar con Google' e inicializa el perfil con 1000 Merit redirigiendo a la pantalla principal.",
            "Fallo de autenticación con Google impide el acceso y muestra mensaje de error.",
            AcceptanceMessages.GOOGLE_SIGNIN_FAILED),
        ShowcaseCriteria("HU 1.2", "Username único",
            "Username nuevo se asocia permanentemente a la cuenta.",
            "Username ya existente es rechazado.",
            AcceptanceMessages.usernameAlreadyInUse("<USERNAME>")),
        ShowcaseCriteria("HU 1.3", "Sesión persistente",
            "Sesión iniciada previamente se restaura automáticamente al abrir la app.",
            "Sesión cerrada previamente muestra pantalla de login.",
            null),
        ShowcaseCriteria("HU 1.4", "Cierre de sesión",
            "Opción Log out finaliza la sesión y redirige al login.",
            "Fallo al cerrar sesión muestra mensaje de error.",
            AcceptanceMessages.LOGOUT_FAILED),
        ShowcaseCriteria("HU 1.5", "Pantalla Home",
            "Carga la palabra del momento con fonética, tipo, rareza, definición y botones.",
            "Falta de conexión al ingresar muestra mensaje y botón reintentar.",
            AcceptanceMessages.WORD_OF_MOMENT_FAILED),
        ShowcaseCriteria("HU 1.6", "Oración de ejemplo",
            "Clic en 'Show example sentence' muestra la oración asociada.",
            "Fallo de servidor muestra mensaje de error.",
            AcceptanceMessages.EXAMPLE_LOAD_FAILED),
        ShowcaseCriteria("HU 1.7", "Historial de partidas",
            "Muestra partidas recientes con puntaje, modo, fecha y resultado.",
            "Fallo de carga muestra mensaje de error.",
            AcceptanceMessages.GAME_HISTORY_FAILED),
        ShowcaseCriteria("HU 1.8", "Resumen de rendimiento",
            "Perfil muestra partidas jugadas, promedio, mejor puntaje y % victorias.",
            "Fallo de recuperación muestra mensaje de error.",
            AcceptanceMessages.PERFORMANCE_DATA_FAILED),
        ShowcaseCriteria("HU 1.9", "Actualización de estadísticas",
            "Estadísticas generales del perfil se actualizan tras la evaluación.",
            "Fallo en actualización muestra mensaje de error.",
            AcceptanceMessages.STATS_UPDATE_FAILED),
        ShowcaseCriteria("HU 1.10", "Persistencia de progreso",
            "Cierre y reapertura conserva historial y estadísticas.",
            "Fallo en recuperación de datos muestra mensaje de reintento.",
            AcceptanceMessages.PROGRESS_RETRIEVE_FAILED),
        ShowcaseCriteria("HU 2.1", "Pantalla de escritura y restricciones",
            "Muestra cuatro restricciones activas al iniciar práctica.",
            "Sin conexión muestra mensaje de error y botón reintentar.",
            AcceptanceMessages.INTERNET_ACTION_FAILED),
        ShowcaseCriteria("HU 2.2", "Editor de texto y validación Submit",
            "Texto cumple mínimo de palabras y presiona 'Submit' para enviar.",
            "Texto no cumple requisitos: botón bloqueado y mensaje visible.",
            AcceptanceMessages.TEXT_REQUIREMENTS_NOT_MET),
        ShowcaseCriteria("HU 2.3", "Evaluación automática R8",
            "Párrafo recibe puntuación 0–100 por coherencia, vocabulario y reglas.",
            "Timeout de evaluación: aviso de demora y registro para reintento.",
            AcceptanceMessages.EVALUATION_TIMEOUT),
        ShowcaseCriteria("HU 2.4", "Feedback detallado",
            "Pantalla de resultados muestra desglose por categorías.",
            "Fallo de estructura: muestra puntaje base y mensaje correspondiente.",
            AcceptanceMessages.DETAILED_FEEDBACK_FAILED),
        ShowcaseCriteria("HU 2.5", "Modo Práctica",
            "Práctica no afecta estadísticas ni historial competitivo.",
            "Sin conexión en práctica muestra mensaje y botón reintentar.",
            AcceptanceMessages.PRACTICE_LOAD_FAILED),
        ShowcaseCriteria("HU 3.1", "Saldo de Merit",
            "Perfil muestra saldo actual de Merit.",
            "Fallo de conexión muestra mensaje de comprobación de internet.",
            AcceptanceMessages.MERIT_BALANCE_FAILED),
        ShowcaseCriteria("HU 3.2", "Recompensa de Merit",
            "Acredita Merit automáticamente y muestra monto obtenido.",
            "Fallo de conexión al acreditar muestra mensaje de servidor.",
            AcceptanceMessages.SERVER_CONNECTION_FAILED),
        ShowcaseCriteria("HU 3.3", "Tarifa de entrada Ranked",
            "Descuenta costo de entrada y permite acceso si hay saldo.",
            "Saldo insuficiente bloquea acceso y muestra mensaje.",
            AcceptanceMessages.INSUFFICIENT_MERIT_TO_ENTER),
        ShowcaseCriteria("HU 3.4", "Acceso al modo Ranked",
            "Seleccionar 'Play Ranked' inicia sesión competitiva con saldo.",
            "Saldo insuficiente detiene proceso con mensaje correspondiente.",
            AcceptanceMessages.RANKED_START_INSUFFICIENT_MERIT),
        ShowcaseCriteria("HU 3.5", "Cola asíncrona de matchmaking",
            "Empareja con rival de rating similar (delta ≤ 30).",
            "Tras 48h sin rival resuelve contra puntuación promedio del jugador.",
            null),
        ShowcaseCriteria("HU 3.6", "Rating actual",
            "Perfil muestra rating competitivo actual.",
            "Fallo al recuperar rating muestra mensaje de fallo.",
            AcceptanceMessages.SERVER_FAILURE),
        ShowcaseCriteria("HU 3.7", "Actualización de rating post-partida",
            "Actualiza rating según el resultado ELO del encuentro.",
            "Fallo al calcular rating muestra mensaje de fallo.",
            AcceptanceMessages.GAME_RANKING_UPDATE_FAILED),
        ShowcaseCriteria("HU 3.8", "Resultado del encuentro",
            "Muestra victoria, derrota o empate en pantalla de resultados.",
            "Fallo al obtener resultados muestra mensaje correspondiente.",
            AcceptanceMessages.GAME_RESULT_UPDATE_FAILED),
        ShowcaseCriteria("HU 3.9", "Variación de rating",
            "Muestra puntos de rating ganados o perdidos (+/-).",
            "Fallo en variación muestra mensaje de servidor.",
            AcceptanceMessages.SERVER_FAILURE),
        ShowcaseCriteria("HU 3.10", "Ranked On-Topic Writing",
            "Inicia partida con reglas y restricciones de On-Topic.",
            "Fallo de carga muestra mensaje de reintento.",
            AcceptanceMessages.ON_TOPIC_START_FAILED),
        ShowcaseCriteria("HU 3.11", "Restricciones avanzadas On-Topic",
            "Muestra tópico, extensión y restricciones avanzadas (1ra persona, pregunta).",
            "Fallo de recuperación muestra mensaje correspondiente.",
            AcceptanceMessages.GAME_RESTRICTIONS_FAILED),
        ShowcaseCriteria("HU 3.12", "Validación automática de restricciones",
            "R8 valida restricciones avanzadas cumplidas e incumplidas.",
            "Fallo en validación muestra mensaje de verificación no posible.",
            AcceptanceMessages.COMPLIANCE_VERIFICATION_FAILED),
        ShowcaseCriteria("HU 3.13", "Detalle de cumplimiento",
            "Pantalla muestra cada restricción cumplida o incumplida.",
            "Fallo de detalle muestra mensaje correspondiente.",
            AcceptanceMessages.RESTRICTION_DETAILS_FAILED),
        ShowcaseCriteria("HU 3.14", "Ranking de temporada",
            "Clasificación estacional resalta posición propia.",
            "Fallo de consulta muestra mensaje correspondiente.",
            AcceptanceMessages.SEASON_STANDINGS_FAILED),
        ShowcaseCriteria("HU 3.15", "Historial de temporadas anteriores",
            "Muestra posición final, rating y Merit de temporadas pasadas.",
            "Fallo de recuperación muestra mensaje correspondiente.",
            AcceptanceMessages.SEASON_HISTORY_FAILED)
    )
}

@Composable
fun AcceptanceShowcaseDialog(onDismiss: () -> Unit, onSelectMessage: (String) -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Card(modifier = Modifier.fillMaxWidth().fillMaxHeight(0.85f).padding(8.dp)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Criterios de Aceptación (60)", style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = onDismiss) { Text("Cerrar") }
                }
                Text("Toca un criterio para simular o verificar su mensaje canónico en ejecución.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ShowcaseCatalog.allCriteria, key = { it.huId }) { item ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                            Column(Modifier.padding(12.dp)) {
                                Text("${item.huId}: ${item.title}", style = MaterialTheme.typography.titleSmall)
                                Spacer(Modifier.height(4.dp))
                                Text("✓ Éxito: ${item.scenario1Success}", style = MaterialTheme.typography.bodySmall)
                                Spacer(Modifier.height(2.dp))
                                Text("✕ Fallo: ${item.scenario2Failure}", style = MaterialTheme.typography.bodySmall)
                                item.failureMessage?.let { msg ->
                                    Spacer(Modifier.height(4.dp))
                                    Text("Mensaje canónico: \"$msg\"", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                                    Button(onClick = { onSelectMessage(msg); onDismiss() }, modifier = Modifier.padding(top = 4.dp)) {
                                        Text("Demostrar Mensaje", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
