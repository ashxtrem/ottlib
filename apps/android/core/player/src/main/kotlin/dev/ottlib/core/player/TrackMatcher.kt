package dev.ottlib.core.player

import dev.ottlib.core.model.TrackIdentity

/** Finds the track that best matches a remembered one. Pure, so the matching rules are unit-tested. */
object TrackMatcher {
    /**
     * Index of the best match for [saved] in [candidates], or null when none shares its language (a different
     * language is never a good substitute — the viewer's defaults apply instead). Ties go to the earlier track.
     */
    fun bestMatch(saved: TrackIdentity, candidates: List<TrackIdentity>): Int? =
        candidates.indices
            .filter { sameLanguage(saved.language, candidates[it].language) }
            .maxByOrNull { score(saved, candidates[it]) * 1_000 - it }

    private fun score(saved: TrackIdentity, candidate: TrackIdentity): Int {
        var score = 0
        if (saved.label != null && saved.label.equals(candidate.label, ignoreCase = true)) score += 8
        if (saved.codec != null && saved.codec.equals(candidate.codec, ignoreCase = true)) score += 4
        if (saved.channels != null && saved.channels == candidate.channels) score += 2
        if (saved.external == candidate.external) score += 1
        return score
    }

    private fun sameLanguage(left: String?, right: String?): Boolean =
        normalise(left) == normalise(right)

    /** Media3 already normalises most codes; this also treats `und` as unknown. */
    private fun normalise(language: String?): String? = language?.lowercase()?.takeUnless { it.isBlank() || it == "und" }
}
