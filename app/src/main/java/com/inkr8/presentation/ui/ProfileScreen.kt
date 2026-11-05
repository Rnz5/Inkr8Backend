package com.inkr8.presentation.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.inkr8.domain.model.User
import com.inkr8.presentation.state.AcceptanceMessages
import com.inkr8.presentation.viewmodel.ProfileViewModel
import java.text.DateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ProfileScreen(user: User, viewModel: ProfileViewModel, logout: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var name by rememberSaveable(user.id) { mutableStateOf(user.name) }
    var selectedSeason by rememberSaveable(user.id) { mutableStateOf<String?>(null) }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { SectionCard {
            Text("Perfil", style = MaterialTheme.typography.titleLarge)
            user.email?.let { Text(it) }
            Text("Liga ${user.league} · Rating ${user.rating}")
            ErrorMessage(state.ratingError)
            Text("Merit disponible: ${user.merit}")
            ErrorMessage(state.meritError)
            if (user.username == null) {
                OutlinedTextField(value = name, onValueChange = { name = it.take(20) }, label = { Text("Username único") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Text("El username que elijas quedará asociado permanentemente a tu cuenta.")
                Button(onClick = { viewModel.save(name) }, enabled = !state.saving) { Text(if (state.saving) "Guardando…" else "Guardar username") }
            } else Text("Username: ${user.username}")
            ErrorMessage(state.error)
            if (state.saved) Text("Username guardado.")
            OutlinedButton(onClick = logout) { Text("Log out") }
        } }
        item { SectionCard {
            Text("Rendimiento competitivo", style = MaterialTheme.typography.titleMedium)
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            ErrorMessage(state.statisticsError ?: state.progressError, viewModel::refresh)
            ErrorMessage(state.updateError)
            state.progress?.statistics?.let { stats ->
                Text("Partidas jugadas: ${stats.gamesPlayed}")
                Text("Promedio de puntuación: ${String.format(Locale.getDefault(), "%.2f", stats.averageScore)}")
                Text("Mejor puntaje: ${stats.bestScore}")
                Text("Victorias: ${String.format(Locale.getDefault(), "%.1f", stats.winRate)} %")
                Text("Las prácticas no afectan estas estadísticas. Las victorias se calculan sobre encuentros resueltos.")
            }
            TextButton(onClick = viewModel::refresh) { Text("Actualizar progreso") }
        } }
        item {
            Text("Historial de partidas", style = MaterialTheme.typography.titleMedium)
            ErrorMessage(state.historyError, viewModel::refresh)
            if (state.progress?.history?.isEmpty() == true) Text("Aún no tienes partidas competitivas evaluadas.")
        }
        items(state.progress?.history.orEmpty(), key = { it.id }) { game -> SectionCard {
            Text("Ranked · ${if (game.writingMode.name == "ON_TOPIC") "On-Topic Writing" else "Estándar"}")
            Text(DateFormat.getDateTimeInstance().format(Date(game.timestamp)))
            Text("Puntaje: ${game.evaluation?.score ?: "—"} · ${when (game.match?.outcome) { "WIN" -> "Victoria"; "LOSS" -> "Derrota"; "DRAW" -> "Empate"; else -> if (game.matchStatus.name == "EXPIRED") "Temporada cerrada" else "Esperando rival" }}")
        } }
        item { SectionCard {
            Text("Temporadas anteriores", style = MaterialTheme.typography.titleMedium)
            if (state.seasonsLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            ErrorMessage(state.seasonsError, viewModel::loadSeasons)
            if (!state.seasonsLoading && state.seasons.isEmpty() && state.seasonsError == null) Text("No hay temporadas anteriores registradas.")
            state.seasons.forEach { entry ->
                TextButton(onClick = { selectedSeason = entry.season.id }) { Text("Temporada ${entry.season.id} · ${seasonDates(entry.season)}") }
            }
            state.seasons.firstOrNull { it.season.id == selectedSeason }?.let { entry ->
                Text("Posición final: ${entry.position}")
                Text("Rating de cierre: ${entry.rating}")
                Text("Recompensas obtenidas: ${entry.meritEarned} Merit")
            }
        } }
    }
}
