package com.inkr8.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.inkr8.domain.model.*
import com.inkr8.domain.policy.GamePolicy
import com.inkr8.domain.repository.Draft
import com.inkr8.domain.usecase.*
import com.inkr8.presentation.state.AcceptanceMessages
import com.inkr8.presentation.state.GameUiState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.io.IOException
import java.util.UUID

class GameViewModel(
    private val userId: String, private val mode: PlayMode, private val startGame: StartGame,
    private val submit: SubmitWriting, private val observeGame: ObserveGame, private val recentGames: GetRecentGames,
    private val retry: RetryEvaluation,
    private val loadDraft: LoadDraft, private val saveDraft: SaveDraft,
    private val clearDraft: ClearDraft, private val findDraft: FindDraft
) : ViewModel() {
    private val mutableState = MutableStateFlow(GameUiState())
    val state = mutableState.asStateFlow()
    private var gameJob: Job? = null
    init {
        loadDraft(userId, mode)?.let { draft ->
            updateState { GameUiState(requestId = draft.id, writingMode = draft.writingMode, text = draft.text) }
            watch(draft.id)
        }
        refreshRecent()
    }
    fun select(writingMode: WritingMode) {
        if (state.value.requestId == null && !state.value.busy) updateState { it.copy(writingMode = writingMode) }
    }
    fun edit(text: String) {
        if (state.value.game?.status != GameStatus.DRAFT) return
        updateState { it.copy(text = text.take(10000), error = null) }
        persist()
    }
    private fun updateState(transform: (GameUiState) -> GameUiState) {
        mutableState.update { current ->
            val next = transform(current)
            next.copy(
                wordCount = GamePolicy.wordCount(next.text),
                canSubmit = next.game?.let { game ->
                    game.status == GameStatus.DRAFT && GamePolicy.validateWriting(next.text, game.writingMode) == null
                } ?: false
            )
        }
    }
    private fun persist() { state.value.requestId?.let { saveDraft(userId, mode, Draft(it, state.value.writingMode, state.value.text)) } }
    fun start() {
        if (state.value.busy || state.value.game != null) return
        val id = state.value.requestId ?: UUID.randomUUID().toString()
        updateState { it.copy(requestId = id, busy = true, error = null) }
        persist()
        viewModelScope.launch {
            try {
                val game = startGame(id, mode, state.value.writingMode)
                updateState { it.copy(game = game, busy = false, error = null) }
                watch(id)
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                val errMsg = error.message.orEmpty()
                val message = when {
                    errMsg.contains("Merit insuficiente", ignoreCase = true) || errMsg.contains("Insufficient Merit", ignoreCase = true) ->
                        AcceptanceMessages.RANKED_START_INSUFFICIENT_MERIT
                    errMsg.contains("restricciones", ignoreCase = true) || errMsg.contains("restrictions", ignoreCase = true) ->
                        AcceptanceMessages.GAME_RESTRICTIONS_FAILED
                    mode == PlayMode.PRACTICE ->
                        AcceptanceMessages.PRACTICE_LOAD_FAILED
                    state.value.writingMode == WritingMode.ON_TOPIC ->
                        AcceptanceMessages.ON_TOPIC_START_FAILED
                    else ->
                        AcceptanceMessages.INTERNET_ACTION_FAILED
                }
                updateState { it.copy(busy = false, error = message) }
            }
        }
    }
    fun send() {
        val game = state.value.game ?: return
        if (state.value.busy) return
        if (!state.value.canSubmit) {
            updateState { it.copy(error = AcceptanceMessages.TEXT_REQUIREMENTS_NOT_MET) }
            return
        }
        updateState { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                submit(game, state.value.text)
                updateState { it.copy(busy = false) }
                refreshRecent()
            }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                if (error is IOException) {
                    updateState { it.copy(busy = false, error = AcceptanceMessages.SERVER_CONNECTION_FAILED) }
                } else {
                    fail(error)
                }
            }
        }
    }
    fun retryEvaluation() {
        val id = state.value.game?.id ?: return
        if (state.value.busy) return
        updateState { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try { retry(id); updateState { it.copy(busy = false) }; watch(id) }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { fail(error) }
        }
    }
    fun open(game: Game) {
        if (state.value.busy) return
        val text = if (game.status == GameStatus.DRAFT) findDraft(userId, game.id)?.text ?: game.content else game.content
        updateState { it.copy(game = game, requestId = game.id, writingMode = game.writingMode, text = text, error = null) }
        persist(); watch(game.id)
    }
    fun newGame() {
        if (state.value.busy) return
        gameJob?.cancel(); clearDraft(userId, mode)
        updateState { GameUiState(recent = it.recent) }
        refreshRecent()
    }
    fun reconnect() { state.value.requestId?.let { watch(it) }; refreshRecent() }
    fun clearNotice() { updateState { it.copy(resultNotice = null) } }
    private fun watch(id: String) {
        gameJob?.cancel()
        gameJob = viewModelScope.launch {
            try { observeGame(id).collect { game ->
                updateState { it.copy(game = game, writingMode = game.writingMode,
                    text = if (game.status == GameStatus.DRAFT) it.text else game.content, error = null,
                    resultNotice = if (game.status == GameStatus.EVALUATED && it.game?.status in listOf(GameStatus.PENDING, GameStatus.FAILED)) "Tu resultado está listo: ${game.evaluation?.score} puntos" else it.resultNotice) }
            } } catch (error: CancellationException) { throw error }
            catch (error: Exception) { fail(error) }
        }
    }
    fun refreshRecent() { viewModelScope.launch {
        updateState { it.copy(loadingRecent = true, recentError = null) }
        try {
            val recent = recentGames().filter { game -> game.mode == mode }
            updateState { it.copy(recent = recent, loadingRecent = false) }
        }
        catch (error: CancellationException) { throw error }
        catch (error: Exception) { updateState { it.copy(loadingRecent = false, recentError = AcceptanceMessages.GAME_HISTORY_FAILED) } }
    } }
    private fun fail(error: Exception) { updateState { it.copy(busy = false, error = error.message ?: AcceptanceMessages.SERVER_CONNECTION_FAILED) } }
}
