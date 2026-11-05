package com.inkr8.data.mapper

import com.inkr8.data.dto.*
import com.inkr8.domain.model.*
import com.inkr8.domain.policy.AcceptanceMessages

internal fun UserDto.toDomain() = User(id, name, email, merit, rating, league, username)
internal fun WireMap.toWord() = Word(string("text"), string("definition"), string("sentence"), string("phonetic"), string("partOfSpeech"), string("rarity"))
internal fun WireMap.toSeason() = Season(string("id"), number("start"), number("end"))
internal fun WireMap.toHome() = Home(this["word"].wire().toWord(), this["season"].wire().toSeason(), number("rankedCost"), number("wordDay"))
internal fun WireMap.toRanking() = SeasonRanking(this["season"].wire().toSeason(), maps("members").map {
    SeasonMember(it.string("userId"), it.string("name"), it.number("rating"), it.number("league").toInt(), it.number("position"))
}, (this["own"] as? Map<*, *>)?.wire()?.let { SeasonMember(it.string("userId"), it.string("name"), it.number("rating"), it.number("league").toInt(), it.number("position")) })
internal fun WireMap.toSeasonHistory() = SeasonHistory(this["season"].wire().toSeason(), number("position"), number("rating"), number("meritEarned"))
internal fun WireMap.toProgress(): Progress {
    val stats = this["statistics"].wire()
    return Progress(maps("history").map { GameDto(it.string("id"), it).toDomain() }, Statistics(stats.number("gamesPlayed"),
        (stats["averageScore"] as Number).toDouble(), (stats["bestScore"] as Number).toDouble(), (stats["winRate"] as Number).toDouble()))
}
internal fun GameDto.toDomain(): Game {
    val challenge = fields["challenge"].wire()
    val evaluation = fields["evaluation"]?.wire()?.let {
        val constraintMaps = (it["constraints"] as? List<*>)?.mapNotNull { item ->
            (item as? Map<*, *>)?.wire()?.takeIf { rule -> rule["label"] is String && rule["fulfilled"] is Boolean }
        }
        val constraints = constraintMaps.orEmpty().map { rule -> ConstraintResult(rule.string("label"), rule["fulfilled"] as Boolean) }
        Evaluation((it["score"] as Number).toDouble(), it.string("feedback"), it.number("meritEarned"),
            it.string("spelling"), it.string("vocabulary"), it.string("coherence"), it.string("creativity"), constraints,
            it["feedbackError"] as? String ?: if (listOf("spelling", "vocabulary", "coherence").any { key -> it.string(key).isBlank() }) AcceptanceMessages.DETAILED_FEEDBACK_FAILED else null,
            it["constraintsError"] as? String ?: if (constraintMaps == null || constraintMaps.size != (it["constraints"] as? List<*>)?.size) AcceptanceMessages.RESTRICTION_DETAILS_FAILED else null)
    }
    val match = (fields["match"] as? Map<*, *>)?.wire()?.takeIf { it["opponentScore"] is Number && it["outcome"] in listOf("WIN", "LOSS", "DRAW") }?.let {
        MatchResult(it.string("opponentName"), (it["opponentScore"] as Number).toDouble(), it.string("outcome"), (it["ratingChange"] as? Number)?.toLong())
    }
    return Game(id, PlayMode.valueOf(fields.string("mode")), WritingMode.valueOf(fields.string("writingMode")),
        Challenge(challenge.maps("words").map { it.toWord() }, challenge["topic"] as? String, challenge["theme"] as? String, (challenge["advanced"] as? List<*>)?.filterIsInstance<String>().orEmpty()),
        GameStatus.valueOf(fields.string("status")), fields.string("content"), evaluation, match,
        fields["error"] as? String, "s${fields.number("seasonIndex")}",
        MatchStatus.valueOf(fields["matchStatus"] as? String ?: "NONE"), fields.number("timestamp"), fields["matchError"] as? String)
}
