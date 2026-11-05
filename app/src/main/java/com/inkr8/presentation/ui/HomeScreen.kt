package com.inkr8.presentation.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.inkr8.presentation.viewmodel.HomeViewModel
import android.speech.tts.TextToSpeech
import java.util.Locale

@Composable
fun HomeScreen(viewModel: HomeViewModel, practice: () -> Unit, ranked: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var audioReady by remember { mutableStateOf(false) }
    var audioError by remember { mutableStateOf<String?>(null) }
    var speech by remember { mutableStateOf<TextToSpeech?>(null) }
    DisposableEffect(context) {
        val engine = TextToSpeech(context) { status ->
            audioReady = status == TextToSpeech.SUCCESS
            if (!audioReady) audioError = "No se pudo reproducir el audio."
        }
        speech = engine
        onDispose { engine.stop(); engine.shutdown(); speech = null }
    }
    Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        ErrorMessage(state.error, viewModel::refresh)
        state.home?.let { home ->
            SectionCard {
                Text("Word of the Moment", style = MaterialTheme.typography.titleMedium)
                Text(home.word.text, style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
                Text("Fonética: ${home.word.phonetic.ifBlank { "No disponible" }}")
                Text("Tipo: ${home.word.partOfSpeech.ifBlank { "No disponible" }} · Rareza: ${home.word.rarity.ifBlank { "No disponible" }}")
                Text(home.word.definition)
                OutlinedButton(onClick = {
                    val engine = speech
                    val language = engine?.setLanguage(Locale.ENGLISH) ?: TextToSpeech.ERROR
                    audioError = if (language < 0 || engine?.speak(home.word.text, TextToSpeech.QUEUE_FLUSH, null, "word") == TextToSpeech.ERROR) "No se pudo reproducir el audio." else null
                }, enabled = audioReady) { Text("Reproducir audio") }
                ErrorMessage(audioError)
                OutlinedButton(onClick = viewModel::showExample, enabled = !state.exampleLoading) { Text(if (state.exampleLoading) "Cargando…" else "Show example sentence") }
                ErrorMessage(state.exampleError, viewModel::showExample)
                state.example?.let { Text(it) }
            }
            SectionCard {
                Text("Temporada ${home.season.id}", style = MaterialTheme.typography.titleMedium)
                Text(seasonDates(home.season))
                Text("El rating de todos vuelve a 0 cada 14 días. Tu Merit se conserva.")
                Button(onClick = practice) { Text("Practicar") }
                OutlinedButton(onClick = ranked) { Text("Play Ranked · ${home.rankedCost} Merit por entrada") }
            }
        }
    }
}
