package dev.ottlib.core.model

import kotlinx.serialization.Serializable

@Serializable
data class SubtitleSearch(
    val mode: String = "auto", val query: String? = null,
    val languages: List<String> = listOf("en"), val year: Int? = null,
    val season: Int? = null, val episode: Int? = null,
)
@Serializable
data class SubtitleResult(
    val id: String, val provider: String, val language: String, val releaseName: String,
    val format: String, val hearingImpaired: Boolean, val forced: Boolean,
    val hashMatch: Boolean, val downloads: Long, val score: Double, val downloaded: Boolean,
)
@Serializable
data class SubtitleSearchResponse(val results: List<SubtitleResult>, val warnings: List<String>)
@Serializable
data class SubtitleProviderOption(val name: String, val configured: Boolean)
@Serializable
data class SubtitleLanguageOption(val code: String, val name: String)
@Serializable
data class SubtitleOptions(
    val providers: List<SubtitleProviderOption>, val languages: List<SubtitleLanguageOption>,
    val preferredLanguages: List<String>,
)
@Serializable
data class SubtitleDownloadRequest(val resultId: String)
@Serializable
data class SubtitleDownloadResponse(val subtitle: SubtitleSource, val reused: Boolean)
