package com.inkr8.presentation

import com.inkr8.data.dto.GameDto
import com.inkr8.data.mapper.toDomain
import com.inkr8.presentation.state.AcceptanceMessages
import org.junit.Assert.*
import org.junit.Test

class FeedbackMappingTest {
    @Test fun malformedFeedbackRetainsScoreAndMarksOnlyTheMissingDetails() {
        val game = GameDto("id", mapOf(
            "challenge" to mapOf("words" to emptyList<Any>()),
            "mode" to "RANKED", "writingMode" to "STANDARD", "status" to "EVALUATED",
            "evaluation" to mapOf("score" to 78.0, "feedback" to "Base", "constraints" to listOf("invalid")),
            "matchStatus" to "MATCHED", "match" to mapOf("outcome" to "WIN", "opponentScore" to 60.0)
        )).toDomain()
        val evaluation = requireNotNull(game.evaluation)
        assertEquals(78.0, evaluation.score, 0.0)
        assertEquals(AcceptanceMessages.DETAILED_FEEDBACK_FAILED, evaluation.feedbackError)
        assertEquals(AcceptanceMessages.RESTRICTION_DETAILS_FAILED, evaluation.constraintsError)
        assertNull(game.match!!.ratingChange)
    }
}
