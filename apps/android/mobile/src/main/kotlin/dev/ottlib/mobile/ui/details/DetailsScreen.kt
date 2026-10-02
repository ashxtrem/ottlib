package dev.ottlib.mobile.ui.details

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.ottlib.core.presentation.LoadState
import dev.ottlib.core.presentation.appContainer
import dev.ottlib.core.presentation.details.DetailsViewModel
import dev.ottlib.core.presentation.openInExternalPlayer
import dev.ottlib.core.presentation.theme.OttlibColors
import dev.ottlib.mobile.ui.components.ErrorMessage
import dev.ottlib.mobile.ui.components.LoadingMessage
import dev.ottlib.mobile.ui.components.WindowWidth
import dev.ottlib.mobile.ui.components.windowWidth

@Composable
fun DetailsScreen(movieId: Long, onPlay: (id: Long, fromStart: Boolean) -> Unit, onBack: () -> Unit) {
    val container = appContainer()
    val viewModel = viewModel(key = "details-$movieId") { DetailsViewModel(container.api, container.continueWatching, container.appScope, movieId, container.playbackSequence) }
    val state by viewModel.movie.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val nextMovie by viewModel.nextMovie.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LifecycleResumeEffect(viewModel) {
        viewModel.onResume()
        onPauseOrDispose { }
    }

    Box(Modifier.fillMaxSize().background(OttlibColors.Canvas)) {
        when (val current = state) {
            LoadState.Loading -> LoadingMessage()
            is LoadState.Failed -> ErrorMessage(current.message, actionLabel = "Back", onAction = onBack)
            is LoadState.Loaded -> {
                val actions = DetailsActions(
                    onPlay = { fromStart -> onPlay(movieId, fromStart) },
                    nextMovie = nextMovie,
                    onPlayNext = { nextMovie?.let { onPlay(it.id, false) } },
                    onToggleWatched = viewModel::toggleWatched,
                    onClearProgress = viewModel::clearProgress,
                    onPlayElsewhere = {
                        val url = viewModel.streamUrl()
                        if (url == null || !openInExternalPlayer(context, url, current.value.title)) Toast.makeText(context, "No other video player is installed", Toast.LENGTH_LONG).show()
                    },
                )
                val imageUrl = container.api.resolve(current.value.backdropUrl ?: current.value.posterUrl)
                val posterUrl = container.api.resolve(current.value.posterUrl)
                // Two panes once the window is wide enough (unfolded, or phone landscape); one scrolling column otherwise.
                if (windowWidth() == WindowWidth.Compact) CompactDetails(current.value, imageUrl, posterUrl, busy, actions)
                else WideDetails(current.value, imageUrl, posterUrl, busy, actions)
            }
        }
        IconButton(
            onClick = onBack,
            modifier = Modifier.align(Alignment.TopStart).safeDrawingPadding().padding(8.dp).background(OttlibColors.Canvas.copy(alpha = 0.6f), CircleShape),
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
        }
    }
}

/** What the details buttons do; the screen wires these to the ViewModel. */
class DetailsActions(
    val onPlay: (fromStart: Boolean) -> Unit,
    val nextMovie: dev.ottlib.core.model.Movie?,
    val onPlayNext: () -> Unit,
    val onToggleWatched: () -> Unit,
    val onClearProgress: () -> Unit,
    val onPlayElsewhere: () -> Unit,
)
