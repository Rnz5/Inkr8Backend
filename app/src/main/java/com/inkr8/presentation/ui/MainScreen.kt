package com.inkr8.presentation.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.inkr8.domain.model.*
import com.inkr8.presentation.state.Destination
import com.inkr8.presentation.viewmodel.*

@Composable
fun MainScreen(user: User, sessionError: String?, refreshSession: () -> Unit, logout: () -> Unit,
    home: HomeViewModel, profile: ProfileViewModel, ranking: RankingViewModel, practice: GameViewModel, ranked: GameViewModel) {
    var destination by rememberSaveable { mutableStateOf(Destination.HOME) }
    var showCatalog by rememberSaveable { mutableStateOf(false) }
    var demoBannerMessage by remember { mutableStateOf<String?>(null) }
    val practiceState by practice.state.collectAsStateWithLifecycle()
    val rankedState by ranked.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(practiceState.resultNotice) {
        practiceState.resultNotice?.let { snackbar.showSnackbar(it); practice.clearNotice() }
    }
    LaunchedEffect(rankedState.resultNotice) {
        rankedState.resultNotice?.let { snackbar.showSnackbar(it); ranked.clearNotice() }
    }
    LaunchedEffect(rankedState.game?.status, rankedState.game?.match) {
        if (rankedState.game?.status == GameStatus.EVALUATED) profile.refresh(isPostMatchUpdate = true)
    }
    BackHandler(destination != Destination.HOME) { destination = Destination.HOME }
    LaunchedEffect(destination) {
        when (destination) {
            Destination.HOME -> home.refresh()
            Destination.RANKED -> { ranking.refresh(); ranked.refreshRecent() }
            Destination.PRACTICE -> practice.refreshRecent()
            Destination.PROFILE -> { refreshSession(); profile.refresh() }
        }
    }
    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, bottomBar = {
        NavigationBar { Destination.entries.forEach { entry ->
            NavigationBarItem(selected = destination == entry, onClick = { destination = entry },
                icon = { Text(when (entry) { Destination.HOME -> "⌂"; Destination.PRACTICE -> "✎"; Destination.RANKED -> "6"; Destination.PROFILE -> "●" }) }, label = { Text(entry.title) })
        } }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Inkr8 · ${destination.title}", style = MaterialTheme.typography.headlineSmall)
                FilledTonalButton(onClick = { showCatalog = true }, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                    Text("Criterios AC", style = MaterialTheme.typography.labelSmall)
                }
            }
            Text("${user.name} · ${user.merit} Merit · Liga ${user.league} · Rating ${user.rating}")
            ErrorMessage(sessionError, refreshSession)
            demoBannerMessage?.let { banner ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer), modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(modifier = Modifier.padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Demostración AC: \"$banner\"", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
                        TextButton(onClick = { demoBannerMessage = null }) { Text("Descartar", style = MaterialTheme.typography.labelSmall) }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            when (destination) {
                Destination.HOME -> HomeScreen(home, { destination = Destination.PRACTICE }, { destination = Destination.RANKED })
                Destination.PRACTICE -> GameScreen(practice, PlayMode.PRACTICE)
                Destination.RANKED -> GameScreen(ranked, PlayMode.RANKED, ranking)
                Destination.PROFILE -> ProfileScreen(user, profile, logout)
            }
        }
    }
    if (showCatalog) {
        AcceptanceShowcaseDialog(
            onDismiss = { showCatalog = false },
            onSelectMessage = { msg -> demoBannerMessage = msg }
        )
    }
}
