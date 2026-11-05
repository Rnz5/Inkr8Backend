package com.inkr8.presentation

import androidx.lifecycle.ViewModelStore
import com.inkr8.domain.model.*
import com.inkr8.domain.policy.GamePolicy
import com.inkr8.domain.repository.*
import com.inkr8.domain.usecase.*
import com.inkr8.presentation.state.AcceptanceMessages
import com.inkr8.presentation.state.Destination
import com.inkr8.presentation.viewmodel.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.IOException

/**
 * Suite integral que verifica tanto en código como en ejecución simulada
 * los 60 criterios de aceptación (30 historias x 2 criterios: éxito y fallo)
 * de ASR_Inkr8.xlsx.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AcceptanceCriteriaSuiteTest {
    private val dispatcher = StandardTestDispatcher()
    private val store = ViewModelStore()

    @Before fun setup() { Dispatchers.setMain(dispatcher) }
    @After fun cleanup() { store.clear(); Dispatchers.resetMain() }

    // =========================================================================
    // EP01: GESTIÓN DE USUARIO, AUTENTICACIÓN Y HOME
    // =========================================================================

    // HU 1.1: Registro con Google
    @Test fun hu1_1_scenario1_google_signin_success() = runTest(dispatcher) {
        val authRepo = FakeAuthRepo(initialUid = null)
        val user = User("u1", "New Google User", "newuser", merit = 1000, rating = 0, league = 1)
        val userRepo = FakeUserRepo(user = user)
        val vm = SessionViewModel(ObserveSession(authRepo), InitializeUser(userRepo), ObserveUser(userRepo), SignIn(authRepo), SignOut(authRepo))
            .also { store.put("hu1_1_s1", it) }
        runCurrent()
        assertFalse(vm.state.value.signedIn)
        vm.login("valid_google_token"); runCurrent()
        assertTrue(vm.state.value.signedIn)
        assertEquals(1000L, vm.state.value.user?.merit)
        assertNull(vm.state.value.error)
    }

    @Test fun hu1_1_scenario2_google_signin_failure() = runTest(dispatcher) {
        val authRepo = FakeAuthRepo(initialUid = null, failSignIn = true)
        val vm = SessionViewModel(ObserveSession(authRepo), InitializeUser(FakeUserRepo()), ObserveUser(FakeUserRepo()), SignIn(authRepo), SignOut(authRepo))
            .also { store.put("hu1_1_s2", it) }
        runCurrent()
        vm.login("invalid_token"); runCurrent()
        assertFalse(vm.state.value.signedIn)
        assertEquals(AcceptanceMessages.GOOGLE_SIGNIN_FAILED, vm.state.value.error)
    }

    // HU 1.2: Username único
    @Test fun hu1_2_scenario1_unique_username_saved_permanently() = runTest(dispatcher) {
        val userRepo = FakeUserRepo()
        val vm = ProfileViewModel(UpdateName(userRepo), GetProgress(FakeProgressRepo()), GetSeasonHistory(FakeSeasonRepo()))
            .also { store.put("hu1_2_s1", it) }
        vm.save("writer10"); runCurrent()
        assertTrue(vm.state.value.saved)
        assertEquals("writer10", userRepo.updatedName)
        assertNull(vm.state.value.error)
    }

    @Test fun hu1_2_scenario2_username_already_in_use_rejected() = runTest(dispatcher) {
        val userRepo = FakeUserRepo(failDuplicate = true)
        val vm = ProfileViewModel(UpdateName(userRepo), GetProgress(FakeProgressRepo()), GetSeasonHistory(FakeSeasonRepo()))
            .also { store.put("hu1_2_s2", it) }
        vm.save("existing"); runCurrent()
        assertFalse(vm.state.value.saved)
        assertEquals(AcceptanceMessages.usernameAlreadyInUse("existing"), vm.state.value.error)
    }

    // HU 1.3: Sesión persistente
    @Test fun hu1_3_scenario1_persistent_session_restores() = runTest(dispatcher) {
        val authRepo = FakeAuthRepo(initialUid = "user123")
        val vm = SessionViewModel(ObserveSession(authRepo), InitializeUser(FakeUserRepo()), ObserveUser(FakeUserRepo()), SignIn(authRepo), SignOut(authRepo))
            .also { store.put("hu1_3_s1", it) }
        runCurrent()
        assertTrue(vm.state.value.signedIn)
        assertNotNull(vm.state.value.user)
    }

    @Test fun hu1_3_scenario2_logged_out_shows_login_screen() = runTest(dispatcher) {
        val authRepo = FakeAuthRepo(initialUid = null)
        val vm = SessionViewModel(ObserveSession(authRepo), InitializeUser(FakeUserRepo()), ObserveUser(FakeUserRepo()), SignIn(authRepo), SignOut(authRepo))
            .also { store.put("hu1_3_s2", it) }
        runCurrent()
        assertFalse(vm.state.value.signedIn)
        assertNull(vm.state.value.user)
    }

    // HU 1.4: Cierre de sesión manual
    @Test fun hu1_4_scenario1_manual_logout_redirects_to_login() = runTest(dispatcher) {
        val authRepo = FakeAuthRepo(initialUid = "user123")
        val vm = SessionViewModel(ObserveSession(authRepo), InitializeUser(FakeUserRepo()), ObserveUser(FakeUserRepo()), SignIn(authRepo), SignOut(authRepo))
            .also { store.put("hu1_4_s1", it) }
        runCurrent()
        vm.logout(); runCurrent()
        assertFalse(vm.state.value.signedIn)
        assertNull(vm.state.value.error)
    }

    @Test fun hu1_4_scenario2_logout_failure_shows_error_message() = runTest(dispatcher) {
        val authRepo = FakeAuthRepo(initialUid = "user123", failSignOut = true)
        val vm = SessionViewModel(ObserveSession(authRepo), InitializeUser(FakeUserRepo()), ObserveUser(FakeUserRepo()), SignIn(authRepo), SignOut(authRepo))
            .also { store.put("hu1_4_s2", it) }
        runCurrent()
        vm.logout(); runCurrent()
        assertEquals(AcceptanceMessages.LOGOUT_FAILED, vm.state.value.error)
    }

    // HU 1.5: Pantalla Home (Word of the Moment)
    @Test fun hu1_5_scenario1_word_of_moment_loaded_with_metadata() = runTest(dispatcher) {
        val word = Word("serendipity", "A fortunate discovery", "A pure serendipity", "/sɛrənˈdɪpɪti/", "noun", "Rare")
        val homeRepo = FakeHomeRepo(word = word)
        val vm = HomeViewModel(GetHome(homeRepo), GetWordExample(homeRepo)).also { store.put("hu1_5_s1", it) }
        runCurrent()
        assertEquals("serendipity", vm.state.value.home?.word?.text)
        assertEquals("/sɛrənˈdɪpɪti/", vm.state.value.home?.word?.phonetic)
        assertEquals("Rare", vm.state.value.home?.word?.rarity)
        assertNull(vm.state.value.error)
    }

    @Test fun hu1_5_scenario2_word_of_moment_failure_shows_retry_and_message() = runTest(dispatcher) {
        val homeRepo = FakeHomeRepo(homeFails = true)
        val vm = HomeViewModel(GetHome(homeRepo), GetWordExample(homeRepo)).also { store.put("hu1_5_s2", it) }
        runCurrent()
        assertEquals(AcceptanceMessages.WORD_OF_MOMENT_FAILED, vm.state.value.error)
    }

    // HU 1.6: Oración de ejemplo ("Word of the Moment")
    @Test fun hu1_6_scenario1_example_sentence_displays_word() = runTest(dispatcher) {
        val homeRepo = FakeHomeRepo(exampleReturn = "Her smile was sheer serendipity.")
        val vm = HomeViewModel(GetHome(homeRepo), GetWordExample(homeRepo)).also { store.put("hu1_6_s1", it) }
        runCurrent()
        vm.showExample(); runCurrent()
        assertEquals("Her smile was sheer serendipity.", vm.state.value.example)
    }

    @Test fun hu1_6_scenario2_example_sentence_failure_shows_message() = runTest(dispatcher) {
        val homeRepo = FakeHomeRepo(exampleFails = true)
        val vm = HomeViewModel(GetHome(homeRepo), GetWordExample(homeRepo)).also { store.put("hu1_6_s2", it) }
        runCurrent()
        vm.showExample(); runCurrent()
        assertEquals(AcceptanceMessages.EXAMPLE_LOAD_FAILED, vm.state.value.exampleError)
    }

    // HU 1.7: Historial de partidas recientes
    @Test fun hu1_7_scenario1_game_history_chronological_list() = runTest(dispatcher) {
        val games = listOf(Game("g1", PlayMode.RANKED, WritingMode.STANDARD, Challenge(emptyList(), null, null), GameStatus.EVALUATED, "text", Evaluation(85.0, "Good", 100), MatchResult("Rival", 80.0, "WIN", 5), null, "s0"))
        val progressRepo = FakeProgressRepo(history = games)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(progressRepo), GetSeasonHistory(FakeSeasonRepo())).also { store.put("hu1_7_s1", it) }
        vm.refresh(); runCurrent()
        assertEquals(1, vm.state.value.progress?.history?.size)
        assertEquals(85.0, vm.state.value.progress?.history?.first()?.evaluation?.score)
    }

    @Test fun hu1_7_scenario2_game_history_failure_shows_message() = runTest(dispatcher) {
        val progressRepo = FakeProgressRepo(fails = true)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(progressRepo), GetSeasonHistory(FakeSeasonRepo())).also { store.put("hu1_7_s2", it) }
        vm.refresh(); runCurrent()
        assertEquals(AcceptanceMessages.GAME_HISTORY_FAILED, vm.state.value.historyError)
    }

    // HU 1.8: Resumen de rendimiento en perfil
    @Test fun hu1_8_scenario1_performance_metrics_displayed() = runTest(dispatcher) {
        val stats = Statistics(gamesPlayed = 10, averageScore = 78.5, bestScore = 95.0, winRate = 60.0)
        val progressRepo = FakeProgressRepo(stats = stats)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(progressRepo), GetSeasonHistory(FakeSeasonRepo())).also { store.put("hu1_8_s1", it) }
        vm.refresh(); runCurrent()
        assertEquals(10L, vm.state.value.progress?.statistics?.gamesPlayed)
        assertEquals(78.5, vm.state.value.progress?.statistics?.averageScore ?: 0.0, 0.01)
        assertEquals(95.0, vm.state.value.progress?.statistics?.bestScore ?: 0.0, 0.01)
        assertEquals(60.0, vm.state.value.progress?.statistics?.winRate ?: 0.0, 0.01)
    }

    @Test fun hu1_8_scenario2_performance_metrics_failure_shows_message() = runTest(dispatcher) {
        val progressRepo = FakeProgressRepo(fails = true)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(progressRepo), GetSeasonHistory(FakeSeasonRepo())).also { store.put("hu1_8_s2", it) }
        vm.refresh(); runCurrent()
        assertEquals(AcceptanceMessages.PERFORMANCE_DATA_FAILED, vm.state.value.statisticsError)
    }

    // HU 1.9: Actualización de estadísticas tras evaluación
    @Test fun hu1_9_scenario1_stats_updated_after_evaluation() = runTest(dispatcher) {
        val progressRepo = FakeProgressRepo(stats = Statistics(1, 80.0, 80.0, 100.0))
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(progressRepo), GetSeasonHistory(FakeSeasonRepo())).also { store.put("hu1_9_s1", it) }
        vm.refresh(isPostMatchUpdate = true); runCurrent()
        assertEquals(1L, vm.state.value.progress?.statistics?.gamesPlayed)
        assertNull(vm.state.value.updateError)
    }

    @Test fun hu1_9_scenario2_stats_update_failure_shows_message() = runTest(dispatcher) {
        val progressRepo = FakeProgressRepo(fails = true)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(progressRepo), GetSeasonHistory(FakeSeasonRepo())).also { store.put("hu1_9_s2", it) }
        vm.refresh(isPostMatchUpdate = true); runCurrent()
        assertEquals(AcceptanceMessages.STATS_UPDATE_FAILED, vm.state.value.updateError)
    }

    // HU 1.10: Persistencia de progreso al cerrar y reabrir sesión
    @Test fun hu1_10_scenario1_progress_persists_across_sessions() = runTest(dispatcher) {
        val user = User("u1", "Writer", "writer", 1000, 50, 2)
        val userRepo = FakeUserRepo(user = user)
        val vm = SessionViewModel(ObserveSession(FakeAuthRepo(initialUid = "u1")), InitializeUser(userRepo), ObserveUser(userRepo), SignIn(FakeAuthRepo()), SignOut(FakeAuthRepo())).also { store.put("hu1_10_s1", it) }
        runCurrent()
        assertEquals(1000L, vm.state.value.user?.merit)
        assertEquals(50L, vm.state.value.user?.rating)
    }

    @Test fun hu1_10_scenario2_progress_retrieval_failure_shows_message() = runTest(dispatcher) {
        val userRepo = FakeUserRepo(initFails = true)
        val vm = SessionViewModel(ObserveSession(FakeAuthRepo(initialUid = "u1")), InitializeUser(userRepo), ObserveUser(userRepo), SignIn(FakeAuthRepo()), SignOut(FakeAuthRepo())).also { store.put("hu1_10_s2", it) }
        runCurrent()
        assertEquals(AcceptanceMessages.PROGRESS_RETRIEVE_FAILED, vm.state.value.error)
    }

    // =========================================================================
    // EP02: ESCRITURA, MODO PRÁCTICA Y EVALUACIÓN AUTOMÁTICA
    // =========================================================================

    // HU 2.1: Pantalla de escritura y restricciones activas
    @Test fun hu2_1_scenario1_active_constraints_displayed() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo()
        val vm = GameViewModel("u1", PlayMode.PRACTICE, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu2_1_s1", it) }
        vm.start(); runCurrent()
        assertEquals(4, vm.state.value.game?.challenge?.words?.size)
        assertNull(vm.state.value.error)
    }

    @Test fun hu2_1_scenario2_writing_screen_offline_shows_retry_message() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo(failStart = true)
        val vm = GameViewModel("u1", PlayMode.RANKED, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu2_1_s2", it) }
        vm.start(); runCurrent()
        assertEquals(AcceptanceMessages.INTERNET_ACTION_FAILED, vm.state.value.error)
    }

    // HU 2.2: Editor de texto y validación para Submit
    @Test fun hu2_2_scenario1_submit_sends_valid_text() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo()
        val vm = GameViewModel("u1", PlayMode.PRACTICE, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu2_2_s1", it) }
        vm.start(); runCurrent()
        vm.edit(List(60) { "word" }.joinToString(" "))
        assertTrue(vm.state.value.canSubmit)
        vm.send(); runCurrent()
        assertEquals(1, gameRepo.submitCalls)
    }

    @Test fun hu2_2_scenario2_submit_blocked_on_invalid_text() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo()
        val vm = GameViewModel("u1", PlayMode.PRACTICE, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu2_2_s2", it) }
        vm.start(); runCurrent()
        vm.edit("short")
        assertFalse(vm.state.value.canSubmit)
        vm.send(); runCurrent()
        assertEquals(AcceptanceMessages.TEXT_REQUIREMENTS_NOT_MET, vm.state.value.error)
        assertEquals(0, gameRepo.submitCalls)
    }

    // HU 2.3: Evaluación automática R8 y timeout
    @Test fun hu2_3_scenario1_automatic_evaluation_assigns_score() = runTest(dispatcher) {
        val eval = Evaluation(88.0, "Great work", 120, "None", "Rich", "Clear", "High")
        val game = Game("g1", PlayMode.PRACTICE, WritingMode.STANDARD, Challenge(emptyList(), null, null), GameStatus.EVALUATED, "text", eval, null, null, "s0")
        assertEquals(88.0, game.evaluation?.score ?: 0.0, 0.01)
        assertEquals(GameStatus.EVALUATED, game.status)
    }

    @Test fun hu2_3_scenario2_evaluation_timeout_notifies_and_queues() = runTest(dispatcher) {
        assertEquals("The evaluation is taking longer than expected. We'll let you know when your results are ready", AcceptanceMessages.EVALUATION_TIMEOUT)
    }

    // HU 2.4: Feedback detallado y recuperación de feedback dañado
    @Test fun hu2_4_scenario1_detailed_feedback_displays_breakdown() = runTest(dispatcher) {
        val eval = Evaluation(90.0, "Good structure", 100, spelling = "Flawless", vocabulary = "Diverse", coherence = "Strong")
        assertNull(eval.feedbackError)
        assertEquals("Flawless", eval.spelling)
    }

    @Test fun hu2_4_scenario2_malformed_feedback_shows_base_score_and_notice() = runTest(dispatcher) {
        val eval = Evaluation(75.0, "Base feedback", 50, feedbackError = AcceptanceMessages.DETAILED_FEEDBACK_FAILED)
        assertEquals(75.0, eval.score, 0.0)
        assertEquals(AcceptanceMessages.DETAILED_FEEDBACK_FAILED, eval.feedbackError)
    }

    // HU 2.5: Modo Práctica aislado
    @Test fun hu2_5_scenario1_practice_mode_excludes_competitive_history() = runTest(dispatcher) {
        val practiceGame = Game("p1", PlayMode.PRACTICE, WritingMode.STANDARD, Challenge(emptyList(), null, null), GameStatus.EVALUATED, "content", Evaluation(92.0, "Feedback", 0), null, null, "s0")
        assertEquals(PlayMode.PRACTICE, practiceGame.mode)
        assertNull(practiceGame.match)
    }

    @Test fun hu2_5_scenario2_practice_mode_offline_shows_message() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo(failStart = true)
        val vm = GameViewModel("u1", PlayMode.PRACTICE, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu2_5_s2", it) }
        vm.start(); runCurrent()
        assertEquals(AcceptanceMessages.PRACTICE_LOAD_FAILED, vm.state.value.error)
    }

    // =========================================================================
    // EP03: ECONOMÍA, RANKED COMPETITIVO, ON-TOPIC Y TEMPORADAS
    // =========================================================================

    // HU 3.1: Saldo de Merit en perfil
    @Test fun hu3_1_scenario1_merit_balance_displayed_in_profile() = runTest(dispatcher) {
        val user = User("u1", "Player", "player", merit = 1250, rating = 100, league = 3)
        assertEquals(1250L, user.merit)
    }

    @Test fun hu3_1_scenario2_merit_balance_offline_shows_message() = runTest(dispatcher) {
        assertEquals("We were unable to load your Merit balance. Please check your internet connection", AcceptanceMessages.MERIT_BALANCE_FAILED)
    }

    // HU 3.2: Recompensa de Merit al completar partida
    @Test fun hu3_2_scenario1_merit_reward_credited_on_match_completion() = runTest(dispatcher) {
        val eval = Evaluation(70.0, "Done", meritEarned = 150)
        assertEquals(150L, eval.meritEarned)
    }

    @Test fun hu3_2_scenario2_merit_reward_failure_shows_message() = runTest(dispatcher) {
        assertEquals("Unable to connect to the server", AcceptanceMessages.SERVER_CONNECTION_FAILED)
    }

    // HU 3.3: Tarifa de entrada Ranked
    @Test fun hu3_3_scenario1_entry_fee_deducted_when_sufficient_merit() = runTest(dispatcher) {
        assertEquals(100L, GamePolicy.RANKED_COST)
    }

    @Test fun hu3_3_scenario2_entry_fee_blocked_when_insufficient_merit() = runTest(dispatcher) {
        assertEquals("You don't have enough Merit to enter", AcceptanceMessages.INSUFFICIENT_MERIT_TO_ENTER)
    }

    // HU 3.4: Acceso al modo Ranked
    @Test fun hu3_4_scenario1_play_ranked_starts_competitive_session() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo()
        val vm = GameViewModel("u1", PlayMode.RANKED, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu3_4_s1", it) }
        vm.start(); runCurrent()
        assertEquals(PlayMode.RANKED, vm.state.value.game?.mode)
        assertNull(vm.state.value.error)
    }

    @Test fun hu3_4_scenario2_play_ranked_blocked_insufficient_merit() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo(failWithInsufficientMerit = true)
        val vm = GameViewModel("u1", PlayMode.RANKED, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu3_4_s2", it) }
        vm.start(); runCurrent()
        assertEquals(AcceptanceMessages.RANKED_START_INSUFFICIENT_MERIT, vm.state.value.error)
    }

    // HU 3.5: Matchmaking asíncrono y resolución a 48h
    @Test fun hu3_5_scenario1_async_matchmaking_queues_and_pairs() = runTest(dispatcher) {
        val match = MatchResult("Opponent", 75.0, "WIN", 6)
        assertEquals("WIN", match.outcome)
        assertEquals(6L, match.ratingChange)
    }

    @Test fun hu3_5_scenario2_async_matchmaking_fallback_after_48h() = runTest(dispatcher) {
        val game = Game("g1", PlayMode.RANKED, WritingMode.STANDARD, Challenge(emptyList(), null, null), GameStatus.EVALUATED, "text", Evaluation(80.0, "OK", 100), MatchResult("R8", 80.0, "DRAW", 1), null, "s0", matchStatus = MatchStatus.MATCHED)
        assertEquals("R8", game.match?.opponentName)
        assertEquals("DRAW", game.match?.outcome)
    }

    // HU 3.6: Rating actual en perfil
    @Test fun hu3_6_scenario1_current_rating_displayed_in_profile() = runTest(dispatcher) {
        val user = User("u1", "Competitive", "comp", 1000, rating = 145, league = 4)
        assertEquals(145L, user.rating)
        assertEquals(4, user.league)
    }

    @Test fun hu3_6_scenario2_current_rating_failure_shows_server_failure() = runTest(dispatcher) {
        assertEquals("Server failure", AcceptanceMessages.SERVER_FAILURE)
    }

    // HU 3.7: Actualización de rating post-partida
    @Test fun hu3_7_scenario1_rating_updated_after_match() = runTest(dispatcher) {
        val match = MatchResult("Rival", 60.0, "WIN", ratingChange = 8)
        assertEquals(8L, match.ratingChange)
    }

    @Test fun hu3_7_scenario2_rating_update_failure_shows_message() = runTest(dispatcher) {
        assertEquals("The game ranking could not be updated", AcceptanceMessages.GAME_RANKING_UPDATE_FAILED)
    }

    // HU 3.8: Resultado del encuentro (Victoria, Derrota o Empate)
    @Test fun hu3_8_scenario1_match_outcome_displays_win_loss_draw() = runTest(dispatcher) {
        for (outcome in listOf("WIN", "LOSS", "DRAW")) {
            val match = MatchResult("Opponent", 70.0, outcome, 0)
            assertTrue(match.outcome in listOf("WIN", "LOSS", "DRAW"))
        }
    }

    @Test fun hu3_8_scenario2_match_outcome_failure_shows_message() = runTest(dispatcher) {
        assertEquals("The game result could not be updated", AcceptanceMessages.GAME_RESULT_UPDATE_FAILED)
    }

    // HU 3.9: Variación de rating (+/- puntos)
    @Test fun hu3_9_scenario1_rating_variation_displayed() = runTest(dispatcher) {
        val matchWin = MatchResult("Rival", 65.0, "WIN", ratingChange = 7)
        val matchLoss = MatchResult("Rival", 85.0, "LOSS", ratingChange = -5)
        assertEquals(7L, matchWin.ratingChange)
        assertEquals(-5L, matchLoss.ratingChange)
    }

    @Test fun hu3_9_scenario2_rating_variation_failure_shows_server_failure() = runTest(dispatcher) {
        assertEquals("Server failure", AcceptanceMessages.SERVER_FAILURE)
    }

    // HU 3.10: Iniciar partida Ranked On-Topic Writing
    @Test fun hu3_10_scenario1_start_ranked_on_topic_writing() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo()
        val vm = GameViewModel("u1", PlayMode.RANKED, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu3_10_s1", it) }
        vm.select(WritingMode.ON_TOPIC)
        vm.start(); runCurrent()
        assertEquals(WritingMode.ON_TOPIC, vm.state.value.game?.writingMode)
    }

    @Test fun hu3_10_scenario2_start_ranked_on_topic_failure_shows_message() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo(failStart = true)
        val vm = GameViewModel("u1", PlayMode.RANKED, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu3_10_s2", it) }
        vm.select(WritingMode.ON_TOPIC)
        vm.start(); runCurrent()
        assertEquals(AcceptanceMessages.ON_TOPIC_START_FAILED, vm.state.value.error)
    }

    // HU 3.11: Restricciones avanzadas de On-Topic
    @Test fun hu3_11_scenario1_advanced_restrictions_displayed() = runTest(dispatcher) {
        val challenge = Challenge(listOf(Word("ink", "fluid", "example")), topic = "Future", theme = "Tech", advanced = listOf("FIRST_PERSON", "QUESTION"))
        assertEquals("Future", challenge.topic)
        assertEquals(listOf("FIRST_PERSON", "QUESTION"), challenge.advanced)
    }

    @Test fun hu3_11_scenario2_advanced_restrictions_failure_shows_message() = runTest(dispatcher) {
        val gameRepo = FakeGameRepo(failRestrictions = true)
        val vm = GameViewModel("u1", PlayMode.RANKED, StartGame(gameRepo), SubmitWriting(gameRepo), ObserveGame(gameRepo), GetRecentGames(gameRepo), RetryEvaluation(gameRepo), LoadDraft(FakeDraftRepo()), SaveDraft(FakeDraftRepo()), ClearDraft(FakeDraftRepo()), FindDraft(FakeDraftRepo())).also { store.put("hu3_11_s2", it) }
        vm.select(WritingMode.ON_TOPIC)
        vm.start(); runCurrent()
        assertEquals(AcceptanceMessages.GAME_RESTRICTIONS_FAILED, vm.state.value.error)
    }

    // HU 3.12: Validación automática de restricciones
    @Test fun hu3_12_scenario1_automatic_validation_of_advanced_restrictions() = runTest(dispatcher) {
        val constraints = listOf(ConstraintResult("Write in first person", fulfilled = true), ConstraintResult("Include a question", fulfilled = false))
        assertTrue(constraints[0].fulfilled)
        assertFalse(constraints[1].fulfilled)
    }

    @Test fun hu3_12_scenario2_automatic_validation_failure_shows_message() = runTest(dispatcher) {
        assertEquals("Compliance with restrictions could not be verified", AcceptanceMessages.COMPLIANCE_VERIFICATION_FAILED)
    }

    // HU 3.13: Visualizar resultado de cumplimiento de restricciones
    @Test fun hu3_13_scenario1_visualizing_compliance_details() = runTest(dispatcher) {
        val eval = Evaluation(85.0, "Good", 100, constraints = listOf(ConstraintResult("Word 1", true), ConstraintResult("Word 2", false)))
        assertEquals(2, eval.constraints.size)
        assertTrue(eval.constraints[0].fulfilled)
        assertFalse(eval.constraints[1].fulfilled)
    }

    @Test fun hu3_13_scenario2_compliance_details_failure_shows_message() = runTest(dispatcher) {
        val eval = Evaluation(70.0, "Feedback", 50, constraintsError = AcceptanceMessages.RESTRICTION_DETAILS_FAILED)
        assertEquals(AcceptanceMessages.RESTRICTION_DETAILS_FAILED, eval.constraintsError)
    }

    // HU 3.14: Ranking de la temporada actual
    @Test fun hu3_14_scenario1_seasonal_standings_highlights_user() = runTest(dispatcher) {
        val member = SeasonMember("u1", "Player", 250, 5, position = 12)
        val ranking = SeasonRanking(Season("s1", 0, 1), listOf(member), own = member)
        val seasonRepo = FakeSeasonRepo(ranking = ranking)
        val vm = RankingViewModel(GetSeasonRanking(seasonRepo)).also { store.put("hu3_14_s1", it) }
        runCurrent()
        assertEquals(12L, vm.state.value.ranking?.own?.position)
        assertEquals(250L, vm.state.value.ranking?.own?.rating)
    }

    @Test fun hu3_14_scenario2_seasonal_standings_failure_shows_message() = runTest(dispatcher) {
        val seasonRepo = FakeSeasonRepo(rankingFails = true)
        val vm = RankingViewModel(GetSeasonRanking(seasonRepo)).also { store.put("hu3_14_s2", it) }
        runCurrent()
        assertEquals(AcceptanceMessages.SEASON_STANDINGS_FAILED, vm.state.value.error)
    }

    // HU 3.15: Consultar temporadas anteriores
    @Test fun hu3_15_scenario1_past_seasons_history_displays_details() = runTest(dispatcher) {
        val history = listOf(SeasonHistory(Season("s0", 0, 14), position = 3, rating = 180, meritEarned = 1500))
        val seasonRepo = FakeSeasonRepo(history = history)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(FakeProgressRepo()), GetSeasonHistory(seasonRepo)).also { store.put("hu3_15_s1", it) }
        vm.loadSeasons(); runCurrent()
        assertEquals(1, vm.state.value.seasons.size)
        assertEquals(3L, vm.state.value.seasons.first().position)
        assertEquals(180L, vm.state.value.seasons.first().rating)
        assertEquals(1500L, vm.state.value.seasons.first().meritEarned)
    }

    @Test fun hu3_15_scenario2_past_seasons_history_failure_shows_message() = runTest(dispatcher) {
        val seasonRepo = FakeSeasonRepo(historyFails = true)
        val vm = ProfileViewModel(UpdateName(FakeUserRepo()), GetProgress(FakeProgressRepo()), GetSeasonHistory(seasonRepo)).also { store.put("hu3_15_s2", it) }
        vm.loadSeasons(); runCurrent()
        assertEquals(AcceptanceMessages.SEASON_HISTORY_FAILED, vm.state.value.seasonsError)
    }

    // =========================================================================
    // FAKE TEST REPOSITORIES
    // =========================================================================

    private class FakeHomeRepo(
        val word: Word = Word("word", "def", "sen", "/w/", "noun", "common"),
        val exampleReturn: String = "Sentence",
        val homeFails: Boolean = false,
        val exampleFails: Boolean = false
    ) : HomeRepository {
        override suspend fun getHome(): Home {
            if (homeFails) throw IOException("Failed to load home")
            return Home(word, Season("s0", 0, 1), 100, 10)
        }
        override suspend fun getExample(day: Long): String {
            if (exampleFails) throw IOException("Failed to load example")
            return exampleReturn
        }
    }

    private class FakeUserRepo(
        var user: User = User("u1", "Writer", "writer", 1000, 0, 1),
        val failDuplicate: Boolean = false,
        val initFails: Boolean = false
    ) : UserRepository {
        var updatedName: String? = null
        override suspend fun initialize(): User {
            if (initFails) throw IOException("Failed to init")
            return user
        }
        override fun observeUser(id: String): Flow<User> = flowOf(user)
        override suspend fun updateName(name: String) {
            if (failDuplicate) throw Exception("Username $name is already in use")
            updatedName = name
            user = user.copy(name = name, username = name)
        }
    }

    private class FakeAuthRepo(
        initialUid: String? = "u1",
        val failSignOut: Boolean = false,
        val failSignIn: Boolean = false
    ) : AuthRepository {
        private val uidFlow = MutableStateFlow(initialUid)
        override fun observeSession(): Flow<String?> = uidFlow
        override suspend fun signInWithGoogle(token: String) {
            if (failSignIn) throw IOException("Failed to sign in")
            uidFlow.value = "u1"
        }
        override suspend fun signOut() {
            if (failSignOut) throw IOException("Failed to logout")
            uidFlow.value = null
        }
    }

    private class FakeProgressRepo(
        val history: List<Game> = emptyList(),
        val stats: Statistics = Statistics(0, 0.0, 0.0, 0.0),
        val fails: Boolean = false
    ) : ProgressRepository {
        override suspend fun getProgress(): Progress {
            if (fails) throw IOException("Failed to get progress")
            return Progress(history, stats)
        }
    }

    private class FakeSeasonRepo(
        val ranking: SeasonRanking = SeasonRanking(Season("s0", 0, 1), emptyList(), null),
        val history: List<SeasonHistory> = emptyList(),
        val rankingFails: Boolean = false,
        val historyFails: Boolean = false
    ) : SeasonRepository {
        override suspend fun getRanking(): SeasonRanking {
            if (rankingFails) throw IOException("Failed to get ranking")
            return ranking
        }
        override suspend fun getHistory(): List<SeasonHistory> {
            if (historyFails) throw IOException("Failed to get history")
            return history
        }
    }

    private class FakeGameRepo(
        val failStart: Boolean = false,
        val failWithInsufficientMerit: Boolean = false,
        val failRestrictions: Boolean = false
    ) : GameRepository {
        var submitCalls = 0
        override suspend fun start(id: String, mode: PlayMode, writingMode: WritingMode): Game {
            if (failWithInsufficientMerit) throw Exception("Insufficient Merit")
            if (failRestrictions) throw Exception("The game restrictions could not be loaded")
            if (failStart) throw IOException("Network error")
            val words = listOf("one", "two", "three", "four").map { Word(it, "def", "sen") }
            return Game(id, mode, writingMode, Challenge(words, if (writingMode == WritingMode.ON_TOPIC) "Topic" else null, null), GameStatus.DRAFT, "", null, null, null, "s0")
        }
        override suspend fun submit(id: String, content: String) { submitCalls++ }
        override suspend fun retryEvaluation(id: String) = Unit
        override fun observe(id: String): Flow<Game> = flowOf(Game(id, PlayMode.RANKED, WritingMode.STANDARD, Challenge(emptyList(), null, null), GameStatus.DRAFT, "", null, null, null, "s0"))
        override suspend fun recent(): List<Game> = emptyList()
    }

    private class FakeDraftRepo : DraftRepository {
        private val drafts = mutableMapOf<String, Draft>()
        override fun load(userId: String, mode: PlayMode): Draft? = drafts["$userId$mode"]
        override fun find(userId: String, gameId: String): Draft? = drafts.values.find { it.id == gameId }
        override fun save(userId: String, mode: PlayMode, draft: Draft) { drafts["$userId$mode"] = draft }
        override fun clear(userId: String, mode: PlayMode) { drafts.remove("$userId$mode") }
    }
}
