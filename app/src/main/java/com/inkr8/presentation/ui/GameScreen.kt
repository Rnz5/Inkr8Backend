package com.inkr8.presentation.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.inkr8.domain.model.*
import com.inkr8.R
import com.inkr8.domain.policy.GamePolicy
import com.inkr8.presentation.state.AcceptanceMessages
import com.inkr8.presentation.viewmodel.*

@Composable
fun GameScreen(viewModel: GameViewModel, mode: PlayMode, ranking: RankingViewModel? = null) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            ErrorMessage(state.error, { if (state.game == null) viewModel.start() else viewModel.reconnect() })
            if (state.busy || state.loadingRecent) LinearProgressIndicator(Modifier.fillMaxWidth())
            val game = state.game
            if (game == null) SectionCard {
                Text(if (mode == PlayMode.PRACTICE) "Práctica libre" else "Competitivo", style = MaterialTheme.typography.titleLarge)
                if (mode == PlayMode.RANKED) Text("La entrada consume ${GamePolicy.RANKED_COST} Merit al empezar, incluso si abandonas la partida.")
                WritingMode.entries.forEach { writingMode ->
                    Row {
                        RadioButton(selected = state.writingMode == writingMode, enabled = !state.busy && state.requestId == null, onClick = { viewModel.select(writingMode) })
                        Text(if (writingMode == WritingMode.STANDARD) "Estándar · 4 palabras" else "Sobre un tema · 2 palabras", modifier = Modifier.padding(top = 12.dp))
                    }
                }
                Button(onClick = viewModel::start, enabled = !state.busy) { Text(if (state.requestId == null) "Empezar" else "Reintentar entrada") }
            } else SectionCard {
                Text("${if (mode == PlayMode.RANKED) "Ranked" else "Práctica"} · ${game.seasonId}")
                game.challenge.words.forEach { word -> Text("Usar «${word.text}»") }
                game.challenge.topic?.let { Text("Tema: $it") }
                game.challenge.theme?.let { Text("Categoría: $it") }
                Text("Límite: ${game.writingMode.minWords}–${game.writingMode.maxWords} palabras")
                game.challenge.advanced.forEach { rule -> Text(when (rule) { "FIRST_PERSON" -> "Escribir en primera persona"; "QUESTION" -> "Incluir una pregunta"; else -> rule }) }
                when (game.status) {
                    GameStatus.DRAFT -> {
                        OutlinedTextField(value = state.text, onValueChange = viewModel::edit,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 220.dp), label = { Text("Tu texto") }, enabled = !state.busy)
                        Text("${state.wordCount} / ${game.writingMode.minWords}–${game.writingMode.maxWords} palabras")
                        if (!state.canSubmit) Text(AcceptanceMessages.TEXT_REQUIREMENTS_NOT_MET, color = MaterialTheme.colorScheme.error)
                        Button(onClick = viewModel::send, enabled = !state.busy && state.canSubmit) { Text(AcceptanceMessages.SUBMIT_BUTTON_LABEL) }
                    }
                    GameStatus.PENDING -> { CircularProgressIndicator(); Text("R8 está evaluando tu texto. Puedes regresar más tarde y consultar esta partida.") }
                    GameStatus.FAILED -> {
                        Text(game.error ?: "La evaluación falló.", color = MaterialTheme.colorScheme.error)
                        Button(onClick = viewModel::retryEvaluation, enabled = !state.busy) { Text("Reintentar evaluación sin otro costo") }
                    }
                    GameStatus.EVALUATED -> {
                        ErrorMessage(game.matchError, viewModel::reconnect)
                        Image(painter = painterResource(R.drawable.r8pfp), contentDescription = "R8", modifier = Modifier.size(48.dp))
                        game.evaluation?.let { evaluation ->
                            Text("Puntuación: ${evaluation.score}", style = MaterialTheme.typography.headlineMedium)
                            Text(evaluation.feedback)
                            ErrorMessage(evaluation.feedbackError)
                            if (evaluation.spelling.isNotBlank()) Text("Ortografía: ${evaluation.spelling}")
                            if (evaluation.vocabulary.isNotBlank()) Text("Vocabulario: ${evaluation.vocabulary}")
                            if (evaluation.coherence.isNotBlank()) Text("Coherencia: ${evaluation.coherence}")
                            if (evaluation.creativity.isNotBlank()) Text("Creatividad: ${evaluation.creativity}")
                            Text("Cumplimiento de restricciones", style = MaterialTheme.typography.titleMedium)
                            ErrorMessage(evaluation.constraintsError)
                            evaluation.constraints.forEach { rule -> Text("${if (rule.fulfilled) "✓ Cumplida" else "✕ Incumplida"}: ${rule.label}") }
                            Text("+${evaluation.meritEarned} Merit")
                        }
                        game.match?.let { match ->
                            Text("${when (match.outcome) { "WIN" -> "Victoria"; "LOSS" -> "Derrota"; else -> "Empate" }} · ${match.opponentName} (${match.opponentScore})")
                            val delta = match.ratingChange
                            if (delta == null) {
                                ErrorMessage(AcceptanceMessages.SERVER_FAILURE)
                            } else {
                                Text("Rating ${if (delta >= 0) "+" else ""}$delta")
                            }
                        }
                        if (game.matchStatus == MatchStatus.MATCHED && game.match == null) {
                            ErrorMessage(AcceptanceMessages.GAME_RESULT_UPDATE_FAILED)
                        }
                        if (game.matchStatus == MatchStatus.EXPIRED) Text("La temporada terminó antes del emparejamiento. La recompensa de Merit se conserva; esta partida no cambia el rating de la nueva temporada.")
                        else if (mode == PlayMode.RANKED && game.matchStatus == MatchStatus.PENDING) Text("Buscando rival. Después de 48 horas sin rival se usará tu puntuación promedio como referencia.")
                    }
                }
                TextButton(onClick = viewModel::newGame, enabled = !state.busy) { Text("Otra partida") }
            }
        }
        if (ranking != null) item { SeasonRankingCard(ranking) }
        item { Row { Text("Partidas recientes", style = MaterialTheme.typography.titleMedium); TextButton(onClick = viewModel::refreshRecent) { Text("Actualizar") } } }
        item { ErrorMessage(state.recentError, viewModel::refreshRecent) }
        items(state.recent, key = { it.id }) { game ->
            OutlinedButton(onClick = { viewModel.open(game) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                Text("${game.writingMode} · ${game.status} · ${game.evaluation?.score ?: "—"}")
            }
        }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun SeasonRankingCard(viewModel: RankingViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SectionCard {
        Text("Temporada · Ligas 1–6", style = MaterialTheme.typography.titleMedium)
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        ErrorMessage(state.error, viewModel::refresh)
        state.ranking?.let { ranking ->
            Text(seasonDates(ranking.season))
            if (ranking.members.isEmpty()) Text("La temporada aún no tiene participantes.")
            ranking.members.forEach { member -> Text("${member.position}. ${member.name} · Liga ${member.league} · ${member.rating}") }
            ranking.own?.let { member ->
                Surface(color = MaterialTheme.colorScheme.primaryContainer) {
                    Text("Tu posición: ${member.position} · ${member.name} · Rating ${member.rating}", modifier = Modifier.padding(12.dp))
                }
            }
        }
        TextButton(onClick = viewModel::refresh) { Text("Actualizar clasificación") }
    }
}
