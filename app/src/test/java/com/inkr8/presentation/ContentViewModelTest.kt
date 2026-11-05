package com.inkr8.presentation

import androidx.lifecycle.ViewModelStore
import com.inkr8.domain.model.*
import com.inkr8.domain.repository.*
import com.inkr8.domain.usecase.*
import com.inkr8.presentation.state.AcceptanceMessages
import com.inkr8.presentation.viewmodel.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ContentViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val store = ViewModelStore()
    @Before fun setup() { Dispatchers.setMain(dispatcher) }
    @After fun cleanup() { store.clear(); Dispatchers.resetMain() }

    @Test fun exampleIsRequestedOnDemandUsingTheLoadedDayAndCanRetry() = runTest(dispatcher) {
        var calls = 0
        var failing = true
        val home = object : HomeRepository {
            override suspend fun getHome() = Home(Word("ink", "A fluid", "A bottle of ink"), Season("s0", 0, 1), 100, 123)
            override suspend fun getExample(day: Long): String {
                assertEquals(123L, day); calls++
                if (failing) throw IOException()
                return "A bottle of ink"
            }
        }
        val vm = HomeViewModel(GetHome(home), GetWordExample(home)).also { store.put("home", it) }
        runCurrent(); assertEquals(0, calls); assertNull(vm.state.value.example)
        vm.showExample(); runCurrent()
        assertEquals(AcceptanceMessages.EXAMPLE_LOAD_FAILED, vm.state.value.exampleError)
        failing = false; vm.showExample(); runCurrent()
        assertEquals("A bottle of ink", vm.state.value.example); assertNull(vm.state.value.exampleError)
    }

    @Test fun profileRefreshPreservesStatisticsAndSeparatesSeasonErrors() = runTest(dispatcher) {
        var failing = false
        val progress = object : ProgressRepository {
            override suspend fun getProgress(): Progress {
                if (failing) throw IOException()
                return Progress(emptyList(), Statistics(3, 70.0, 80.0, 50.0))
            }
        }
        val seasons = object : SeasonRepository {
            override suspend fun getRanking(): SeasonRanking = throw UnsupportedOperationException()
            override suspend fun getHistory(): List<SeasonHistory> = throw IOException()
        }
        val users = object : UserRepository {
            override suspend fun initialize(): User = throw UnsupportedOperationException()
            override fun observeUser(id: String) = flowOf<User>()
            override suspend fun updateName(name: String) = Unit
        }
        val vm = ProfileViewModel(UpdateName(users), GetProgress(progress), GetSeasonHistory(seasons)).also { store.put("profile", it) }
        vm.refresh(); runCurrent()
        assertEquals(3L, vm.state.value.progress?.statistics?.gamesPlayed)
        assertEquals(AcceptanceMessages.SEASON_HISTORY_FAILED, vm.state.value.seasonsError)
        vm.save("writer"); runCurrent()
        assertEquals(3L, vm.state.value.progress?.statistics?.gamesPlayed)
        failing = true; vm.refresh(); runCurrent()
        assertEquals(AcceptanceMessages.PERFORMANCE_DATA_FAILED, vm.state.value.progressError)
    }

    @Test fun persistedSessionRestoresAndLogoutFailureCanBeRetried() = runTest(dispatcher) {
        val uid = MutableStateFlow<String?>("alice")
        var failLogout = true
        val user = User("alice", "Alice", null, 1000, 0, 1)
        val auth = object : AuthRepository {
            override fun observeSession() = uid
            override suspend fun signInWithGoogle(token: String) { uid.value = "alice" }
            override suspend fun signOut() {
                if (failLogout) throw IOException()
                uid.value = null
            }
        }
        val users = object : UserRepository {
            override suspend fun initialize() = user
            override fun observeUser(id: String) = flowOf(user)
            override suspend fun updateName(name: String) = Unit
        }
        val vm = SessionViewModel(ObserveSession(auth), InitializeUser(users), ObserveUser(users), SignIn(auth), SignOut(auth)).also { store.put("session", it) }
        runCurrent(); assertEquals(user, vm.state.value.user)
        vm.logout(); runCurrent()
        assertEquals(AcceptanceMessages.LOGOUT_FAILED, vm.state.value.error)
        assertEquals(user, vm.state.value.user)
        failLogout = false; vm.logout(); runCurrent()
        assertFalse(vm.state.value.signedIn); assertNull(vm.state.value.user)
    }
}
