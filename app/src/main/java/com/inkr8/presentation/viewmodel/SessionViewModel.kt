package com.inkr8.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.inkr8.domain.usecase.*
import com.inkr8.presentation.state.AcceptanceMessages
import com.inkr8.presentation.state.SessionUiState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class SessionViewModel(private val observeSession: ObserveSession, private val initializeUser: InitializeUser, private val observeUser: ObserveUser, private val signIn: SignIn, private val signOut: SignOut) : ViewModel() {
    private val mutableState = MutableStateFlow(SessionUiState())
    val state = mutableState.asStateFlow()
    private var userJob: Job? = null
    init {
        viewModelScope.launch {
            observeSession().collectLatest { uid ->
                userJob?.cancel()
                mutableState.value = SessionUiState(signedIn = uid != null, loading = uid != null)
                if (uid != null) refresh()
            }
        }
    }
    fun refresh() {
        userJob?.cancel()
        userJob = viewModelScope.launch {
            mutableState.update { it.copy(loading = true, error = null) }
            try {
                val user = initializeUser()
                mutableState.update { it.copy(user = user, loading = false) }
                observeUser(user.id).collect { updated -> mutableState.update { it.copy(user = updated, loading = false, error = null) } }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { mutableState.update { it.copy(loading = false, error = AcceptanceMessages.PROGRESS_RETRIEVE_FAILED) } }
        }
    }
    fun beginLogin() { mutableState.update { it.copy(loading = true, error = null) } }
    fun login(token: String) {
        viewModelScope.launch {
            mutableState.update { it.copy(loading = true, error = null) }
            try { signIn(token) }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { authError(AcceptanceMessages.GOOGLE_SIGNIN_FAILED) }
        }
    }
    fun authError(message: String) { mutableState.update { it.copy(loading = false, error = message) } }
    fun logout() {
        viewModelScope.launch {
            try { signOut() }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { authError(AcceptanceMessages.LOGOUT_FAILED) }
        }
    }
}
