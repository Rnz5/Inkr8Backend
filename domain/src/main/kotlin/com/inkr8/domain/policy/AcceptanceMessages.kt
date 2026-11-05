package com.inkr8.domain.policy

object AcceptanceMessages {
    // HU 1.1
    const val GOOGLE_SIGNIN_FAILED = "Google sign-in failed. Please try again"

    // HU 1.2
    fun usernameAlreadyInUse(username: String) = "Username $username is already in use"

    // HU 1.4
    const val LOGOUT_FAILED = "Error when logging out. Please try again"

    // HU 1.5
    const val WORD_OF_MOMENT_FAILED = "The Word of the Moment could not be loaded. Please check your connection"

    // HU 1.6
    const val EXAMPLE_LOAD_FAILED = "The example could not be loaded. Please try again"

    // HU 1.7
    const val GAME_HISTORY_FAILED = "The game history could not be loaded"

    // HU 1.8
    const val PERFORMANCE_DATA_FAILED = "Performance data could not be retrieved"

    // HU 1.9
    const val STATS_UPDATE_FAILED = "The update could not be completed"

    // HU 1.10
    const val PROGRESS_RETRIEVE_FAILED = "We were unable to retrieve your progress information. Please try again"

    // HU 2.1
    const val INTERNET_ACTION_FAILED = "The action cannot be performed. Please check your Internet connection"

    // HU 2.2
    const val TEXT_REQUIREMENTS_NOT_MET = "Your text does not meet the requirements"
    const val SUBMIT_BUTTON_LABEL = "Submit"

    // HU 2.3
    const val EVALUATION_TIMEOUT = "The evaluation is taking longer than expected. We'll let you know when your results are ready"

    // HU 2.4
    const val DETAILED_FEEDBACK_FAILED = "The detailed feedback could not be loaded at this time"

    // HU 2.5
    const val PRACTICE_LOAD_FAILED = "The action could not be loaded. Please check your connection"

    // HU 3.1
    const val MERIT_BALANCE_FAILED = "We were unable to load your Merit balance. Please check your internet connection"

    // HU 3.2
    const val SERVER_CONNECTION_FAILED = "Unable to connect to the server"

    // HU 3.3
    const val INSUFFICIENT_MERIT_TO_ENTER = "You don't have enough Merit to enter"

    // HU 3.4
    const val RANKED_START_INSUFFICIENT_MERIT = "The ranked match cannot be started. Insufficient Merit"

    // HU 3.6 & HU 3.9
    const val SERVER_FAILURE = "Server failure"

    // HU 3.7
    const val GAME_RANKING_UPDATE_FAILED = "The game ranking could not be updated"

    // HU 3.8
    const val GAME_RESULT_UPDATE_FAILED = "The game result could not be updated"

    // HU 3.10
    const val ON_TOPIC_START_FAILED = "The On-Topic game could not be started. Please try again"

    // HU 3.11
    const val GAME_RESTRICTIONS_FAILED = "The game restrictions could not be loaded"

    // HU 3.12
    const val COMPLIANCE_VERIFICATION_FAILED = "Compliance with restrictions could not be verified"

    // HU 3.13
    const val RESTRICTION_DETAILS_FAILED = "The restriction details could not be loaded"

    // HU 3.14
    const val SEASON_STANDINGS_FAILED = "The season standings could not be loaded"

    // HU 3.15
    const val SEASON_HISTORY_FAILED = "The season history could not be loaded"
}
