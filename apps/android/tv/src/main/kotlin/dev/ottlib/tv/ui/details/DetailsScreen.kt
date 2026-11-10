package dev.ottlib.tv.ui.details

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Button
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.OutlinedButton
import androidx.tv.material3.Text
import dev.ottlib.core.model.Movie
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.details.DetailsViewModel
import dev.ottlib.core.presentation.formatPosition
import dev.ottlib.core.presentation.metaLine
import dev.ottlib.core.presentation.metadata.MetadataViewModel
import dev.ottlib.core.presentation.openInExternalPlayer
import dev.ottlib.core.presentation.player.episodeGapAfter
import dev.ottlib.core.presentation.player.nextLabel
import dev.ottlib.core.presentation.ratingsLine
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.tv.ui.components.AmbientBackdrop
import dev.ottlib.tv.ui.components.ErrorMessage
import dev.ottlib.tv.ui.components.LoadingMessage
import dev.ottlib.tv.ui.components.PosterRow
import dev.ottlib.tv.ui.components.ScreenPadding
import dev.ottlib.tv.ui.components.tryRequestFocus

/** Where Details goes next; the screen itself only plays, opens and toggles. */
class DetailsActions(
    val onPlay: (id: Long, fromStart: Boolean) -> Unit,
    val onOpenMovie: (Long) -> Unit,
    val onCompare: (Long) -> Unit,
    val onOpenActor: (String) -> Unit,
    val onOpenCollection: (id: Long, name: String) -> Unit,
)

@Composable
fun DetailsScreen(
    movieId: Long,
    onPlay: (id: Long, fromStart: Boolean) -> Unit,
    onOpenMovie: (Long) -> Unit,
    onCompare: (Long) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenCollection: (id: Long, name: String) -> Unit,
    onBack: () -> Unit,
) {
    val container = appContainer()
    val viewModel = viewModel(key = "details-$movieId") { DetailsViewModel(container.api, container.continueWatching, container.appScope, movieId, container.playbackSequence, container.hiddenTitles) }
    val state by viewModel.movie.collectAsStateWithLifecycle()
    LifecycleResumeEffect(viewModel) {
        viewModel.onResume()
        onPauseOrDispose { }
    }

    when (val current = state) {
        LoadState.Loading -> LoadingMessage()
        is LoadState.Failed -> ErrorMessage(current.message, actionLabel = "Back", onAction = onBack)
        is LoadState.Loaded -> MovieDetails(current.value, viewModel, DetailsActions(onPlay, onOpenMovie, onCompare, onOpenActor, onOpenCollection))
    }
}

/**
 * Focus runs top to bottom: Play row (initial focus), the metadata and Compare row, cast, collection, recommendations.
 * The focused cast, collection or recommendation card is kept in [DetailsViewModel.lastFocusedKey] so Back lands on it again.
 */
@Composable
private fun MovieDetails(movie: Movie, viewModel: DetailsViewModel, actions: DetailsActions) {
    val container = appContainer()
    val context = LocalContext.current
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val nextMovie by viewModel.nextMovie.collectAsStateWithLifecycle()
    val hidden by viewModel.hidden.collectAsStateWithLifecycle()
    val recommendations by viewModel.recommendations.collectAsStateWithLifecycle()
    val copies by viewModel.copies.collectAsStateWithLifecycle()
    val ratings by viewModel.ratings.collectAsStateWithLifecycle()
    val castMembers by viewModel.castMembers.collectAsStateWithLifecycle()
    val logoUrl by viewModel.logoUrl.collectAsStateWithLifecycle()
    val collection by viewModel.collection.collectAsStateWithLifecycle()

    val primary = remember { FocusRequester() }
    val restore = remember { FocusRequester() }
    // Read once per entry: the card focused before leaving this screen.
    val restoreKey = remember(movie.id) { viewModel.lastFocusedKey }
    val recordFocus: (String) -> Unit = { viewModel.lastFocusedKey = it }
    // Focus on the buttons means Back should come back to them (Play), not to an old card.
    val forgetCard = Modifier.onFocusChanged { if (it.hasFocus) viewModel.lastFocusedKey = null }
    val metadataFocus = remember { FocusRequester() }
    var metadataOpen by remember(movie.id) { mutableStateOf(false) }
    var restoreMetadataFocus by remember(movie.id) { mutableStateOf(false) }
    val resume = movie.resumePositionMs?.takeIf { it > 0 }
    val meta = listOf(movie.metaLine(), ratings.ratingsLine()).filter { it.isNotEmpty() }.joinToString("  ·  ")

    Box(Modifier.fillMaxSize()) {
        AmbientBackdrop(container.api.resolve(movie.backdropUrl ?: movie.posterUrl), blurred = movie.backdropUrl == null, strength = if (movie.backdropUrl != null) 0.6f else 0.35f)
        Column(
            Modifier.fillMaxHeight().fillMaxWidth(0.62f).padding(horizontal = ScreenPadding, vertical = 32.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            TitleLogo(logoUrl, movie.title)
            Text(meta, style = MaterialTheme.typography.titleMedium, color = OttlibColors.Muted)
            if (movie.genres.isNotEmpty()) Text(movie.genres.joinToString("  ·  "), style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Muted)
            movie.overview?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Foreground, maxLines = 4, overflow = TextOverflow.Ellipsis) }

            if (movie.missing) Text("This file is unavailable on the server (it may be on a disconnected drive).", style = MaterialTheme.typography.bodyLarge, color = OttlibColors.Error)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = forgetCard.padding(top = 8.dp)) {
                Button(onClick = { actions.onPlay(movie.id, false) }, enabled = !movie.missing, modifier = Modifier.focusRequester(primary)) {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(22.dp))
                    Text(if (resume != null) "Resume from ${formatPosition(resume)}" else "Play", modifier = Modifier.padding(start = 8.dp))
                }
                if (resume != null) OutlinedButton(onClick = { actions.onPlay(movie.id, true) }, enabled = !movie.missing) { Text("Play from start") }
                OutlinedButton(onClick = viewModel::toggleWatched, enabled = !busy) { Text(if (movie.watched) "Mark unwatched" else "Mark watched") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = forgetCard) {
                if (movie.resumePositionMs != null) OutlinedButton(onClick = viewModel::clearProgress, enabled = !busy) { Text("Remove from Continue watching") }
                OutlinedButton(onClick = {
                    val url = viewModel.streamUrl()
                    if (url == null || !openInExternalPlayer(context, url, movie.title)) Toast.makeText(context, "No other video player is installed", Toast.LENGTH_LONG).show()
                }, enabled = !movie.missing) { Text("Play in another app") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = forgetCard) {
                OutlinedButton(onClick = { metadataOpen = true }, modifier = Modifier.focusRequester(metadataFocus)) {
                    Text(if (movie.metadataStatus == "suggested") "Review suggested matches" else "Manage metadata")
                }
                val isShow = movie.showKey != null
                if (copies > 0) OutlinedButton(onClick = { actions.onCompare(movie.id) }) { Text(if (copies == 1) "Compare with 1 other copy" else "Compare with $copies other copies") }
                OutlinedButton(onClick = viewModel::toggleHidden) { Text(if (hidden) (if (isShow) "Unhide show" else "Unhide") else (if (isShow) "Hide show on this TV" else "Hide on this TV")) }
            }

            nextMovie?.let { next ->
                Text("${next.nextLabel()}: ${next.title}", color = OttlibColors.Foreground)
                next.episodeGapAfter(movie)?.let { Text(it, color = OttlibColors.Muted) }
                OutlinedButton(onClick = { actions.onPlay(next.id, false) }, modifier = forgetCard) { Text("Play next") }
            }
            if (movie.watched) Text("✓ Watched", color = OttlibColors.Success)
            if (castMembers.isNotEmpty()) {
                CastRow(castMembers, onOpen = actions.onOpenActor, onFocused = recordFocus, restoreKey = restoreKey, restore = restore)
            } else if (movie.cast.isNotEmpty()) {
                Text("Starring ${movie.cast.take(5).joinToString(", ")}", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            TechnicalDetails(movie)
            collection?.let { saga ->
                CollectionRow(
                    saga,
                    onOpenMovie = actions.onOpenMovie,
                    onSeeAll = { actions.onOpenCollection(saga.id, saga.name) },
                    onFocused = recordFocus,
                    restoreKey = restoreKey,
                    restore = restore,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            if (recommendations.isNotEmpty()) {
                var focusedReason by remember(movie.id) { mutableStateOf<String?>(null) }
                val byId = remember(recommendations) { recommendations.associateBy { it.poster.id } }
                PosterRow(
                    title = "More like this",
                    items = recommendations.map { it.poster },
                    onOpen = { actions.onOpenMovie(it.id) },
                    onFocused = {
                        focusedReason = byId[it.id]?.reason
                        recordFocus(recommendationKey(it.id))
                    },
                    itemModifier = { item -> if (recommendationKey(item.id) == restoreKey) Modifier.focusRequester(restore) else Modifier },
                    horizontalPadding = 0.dp,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Text(focusedReason ?: " ", style = MaterialTheme.typography.bodyMedium, color = OttlibColors.Muted)
            }
        }
    }
    // First entry focuses Play; returning puts focus back on the card that had it (Play when that card is gone).
    LaunchedEffect(movie.id) {
        // The saved card's row (cast, collection, recommendations) may compose a few frames later: retry before Play.
        var restored = false
        if (restoreKey != null) repeat(10) {
            if (!restored) { withFrameNanos { }; restored = runCatching { restore.requestFocus() }.getOrDefault(false) }
        }
        if (!restored) primary.tryRequestFocus()
    }
    if (metadataOpen) {
        val editor = viewModel(key = "metadata-${movie.id}") { MetadataViewModel(container.api, container.metadataRefresh, movie) }
        MetadataDialog(movie, editor, onDismiss = { metadataOpen = false; restoreMetadataFocus = true })
    }
    LaunchedEffect(metadataOpen) {
        if (!metadataOpen && restoreMetadataFocus) { metadataFocus.tryRequestFocus(); restoreMetadataFocus = false }
    }
}

private fun recommendationKey(id: Long) = "rec:$id"
