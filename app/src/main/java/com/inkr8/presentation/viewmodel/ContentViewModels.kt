package com.inkr8.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.inkr8.domain.usecase.*
import com.inkr8.presentation.state.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class HomeViewModel(private val getHome: GetHome, private val getExample: GetWordExample) : ViewModel() {
    private val mutableState = MutableStateFlow(HomeUiState())
    val state = mutableState.asStateFlow()
    private var refreshJob: Job? = null
    private var exampleJob: Job? = null
    init { refresh() }
    fun refresh() { exampleJob?.cancel(); refreshJob?.cancel(); refreshJob = viewModelScope.launch {
        mutableState.value = HomeUiState()
        try { mutableState.value = HomeUiState(home = getHome(), loading = false) }
        catch (error: CancellationException) { throw error }
        catch (error: Exception) { mutableState.update { it.copy(loading = false, error = AcceptanceMessages.WORD_OF_MOMENT_FAILED) } }
    } }
    fun showExample() {
        val day = state.value.home?.wordDay ?: return
        if (state.value.exampleLoading) return
        exampleJob = viewModelScope.launch {
            mutableState.update { it.copy(exampleLoading = true, exampleError = null) }
            try { val sentence = getExample(day); mutableState.update { it.copy(example = sentence, exampleLoading = false) } }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { mutableState.update { it.copy(exampleLoading = false, exampleError = AcceptanceMessages.EXAMPLE_LOAD_FAILED) } }
        }
    }
}

class RankingViewModel(private val getRanking: GetSeasonRanking) : ViewModel() {
    private val mutableState = MutableStateFlow(RankingUiState())
    val state = mutableState.asStateFlow()
    private var refreshJob: Job? = null
    init { refresh() }
    fun refresh() { refreshJob?.cancel(); refreshJob = viewModelScope.launch {
        mutableState.update { it.copy(loading = true, error = null) }
        try { mutableState.value = RankingUiState(ranking = getRanking(), loading = false) }
        catch (error: CancellationException) { throw error }
        catch (error: Exception) { mutableState.update { it.copy(loading = false, error = AcceptanceMessages.SEASON_STANDINGS_FAILED) } }
    } }
}

class ProfileViewModel(private val updateName: UpdateName, private val getProgress: GetProgress, private val getSeasons: GetSeasonHistory) : ViewModel() {
    private val mutableState = MutableStateFlow(ProfileUiState())
    val state = mutableState.asStateFlow()
    private var refreshJob: Job? = null
    private var seasonsJob: Job? = null
    fun refresh(isPostMatchUpdate: Boolean = false) {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            mutableState.update { it.copy(loading = true, progressError = null, updateError = null, historyError = null, statisticsError = null) }
            try {
                val progress = getProgress()
                mutableState.update { it.copy(progress = progress, loading = false) }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        loading = false,
                        progressError = AcceptanceMessages.PERFORMANCE_DATA_FAILED,
                        statisticsError = AcceptanceMessages.PERFORMANCE_DATA_FAILED,
                        historyError = AcceptanceMessages.GAME_HISTORY_FAILED,
                        updateError = if (isPostMatchUpdate) AcceptanceMessages.STATS_UPDATE_FAILED else null
                    )
                }
            }
        }
        loadSeasons()
    }
    fun loadSeasons() {
        seasonsJob?.cancel()
        seasonsJob = viewModelScope.launch {
            mutableState.update { it.copy(seasonsLoading = true, seasonsError = null) }
            try { val seasons = getSeasons(); mutableState.update { it.copy(seasons = seasons, seasonsLoading = false) } }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { mutableState.update { it.copy(seasonsLoading = false, seasonsError = AcceptanceMessages.SEASON_HISTORY_FAILED) } }
        }
    }
    fun save(name: String) {
        if (state.value.saving) return
        mutableState.update { it.copy(saving = true, saved = false, error = null) }
        viewModelScope.launch {
            try { updateName(name); mutableState.update { it.copy(saving = false, saved = true) } }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                val msg = error.message ?: AcceptanceMessages.usernameAlreadyInUse(name)
                val canonicalMsg = if (msg.contains("ya está en uso") || msg.contains("already in use")) {
                    AcceptanceMessages.usernameAlreadyInUse(name.trim())
                } else msg
                mutableState.update { it.copy(saving = false, error = canonicalMsg) }
            }
        }
    }
}
